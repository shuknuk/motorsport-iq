import Foundation
import Observation

enum AppRoute: Sendable { case home, lobby, game }
enum ReportReason: String, CaseIterable, Sendable { case wrongAnswer = "WRONG_ANSWER", badExplanation = "BAD_EXPLANATION", unclearQuestion = "UNCLEAR_QUESTION", telemetryMismatch = "TELEMETRY_MISMATCH", other = "OTHER" }

@MainActor
@Observable
final class AppModel {
    let socket: SocketService
    let soundService: SoundService
    var route: AppRoute = .home
    var username = UserDefaults.standard.string(forKey: "msp_username") ?? ""
    var lobbyCode = UserDefaults.standard.string(forKey: "msp_lobby_code") ?? ""
    var userId = UserDefaults.standard.string(forKey: "msp_user_id") ?? UUID().uuidString
    var lobbyState: LobbyState?
    var currentQuestion: QuestionEvent?
    var questionState: QuestionState = .unknown
    var latestResolution: ResolutionEvent?
    var leaderboard: [LeaderboardEntry] = []
    var snapshot: RaceSnapshotEvent?
    var feedStalled = false
    var sessions: [SessionInfo] = []
    var isLoadingSessions = false
    var selectedAnswer: String?
    var isBusy = false
    var errorMessage: String?
    var showReport = false
    var reportReason: ReportReason = .other
    var reportNote = ""
    var reportSubmitted = false
    private var restoredAnswers: [String: String] = [:]
    var soundsEnabled = UserDefaults.standard.object(forKey: "msp_sounds_enabled") as? Bool ?? true {
        didSet { UserDefaults.standard.set(soundsEnabled, forKey: "msp_sounds_enabled") }
    }
    var isUITest: Bool { ProcessInfo.processInfo.arguments.contains("--uitest") }

    init(socket: SocketService = SocketService(), soundService: SoundService = SoundService()) {
        self.socket = socket
        self.soundService = soundService
        socket.onEvent = { [weak self] event in self?.handle(event) }
        if !isUITest { socket.connect() }
        if !lobbyCode.isEmpty {
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(500))
                guard let self, !self.userId.isEmpty else { return }
                self.socket.reconnectLobby(userId: self.userId)
            }
        }
    }

    func createLobby() {
        guard !isBusy else { return }
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { errorMessage = "Enter a username first."; return }
        persistIdentity(); isBusy = true; socket.createLobby(username: username)
    }

    func joinLobby() {
        guard !isBusy else { return }
        let code = lobbyCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { errorMessage = "Enter a username first."; return }
        guard !code.isEmpty else { errorMessage = "Enter a lobby code."; return }
        lobbyCode = code; persistIdentity(); isBusy = true; socket.joinLobby(code: code, username: username, restoreUserId: userId)
    }

    func joinSolo(_ session: SessionInfo) {
        guard !isBusy else { return }
        guard let key = session.sessionKey.map(String.init), !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { errorMessage = "Enter a username first."; return }
        persistIdentity(); isBusy = true; socket.joinSolo(username: username, sessionKey: key, restoreUserId: userId, replaySpeed: replaySpeed)
    }

    var replaySpeed: Double = UserDefaults.standard.object(forKey: "msp_replay_speed") as? Double ?? 10 {
        didSet { UserDefaults.standard.set(replaySpeed, forKey: "msp_replay_speed") }
    }

    func startSession(sessionID overrideSessionID: String? = nil) {
        guard !isBusy else { return }
        guard let lobby = lobbyState else { return }
        let sessionID = overrideSessionID ?? lobby.sessionId ?? sessions.first?.sessionKey.map(String.init)
        guard let sessionID else { return }
        isBusy = true
        socket.startSession(lobbyId: lobby.id, sessionId: sessionID, userId: userId, replaySpeed: lobby.replaySpeed)
    }

    func loadSessionsIfNeeded() {
        guard !isUITest, !isLoadingSessions, sessions.isEmpty else { return }
        isLoadingSessions = true
        socket.getSessions()
    }

    func submitAnswer(_ answer: String) {
        guard let question = currentQuestion, selectedAnswer == nil else { return }
        selectedAnswer = answer; socket.submitAnswer(instanceId: question.instanceId, answer: answer)
    }

    func leaveLobby() {
        socket.leaveLobby(); lobbyState = nil; currentQuestion = nil; latestResolution = nil; leaderboard = []; lobbyCode = ""; route = .home
        UserDefaults.standard.removeObject(forKey: "msp_lobby_code")
    }

    func submitReport() {
        guard let instanceId = currentQuestion?.instanceId, let url = URL(string: "/reports", relativeTo: socket.baseURL) else { return }
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["instanceId": instanceId, "userId": userId, "reason": reportReason.rawValue, "note": reportNote])
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                guard (response as? HTTPURLResponse)?.statusCode ?? 500 < 300 else { throw URLError(.badServerResponse) }
                reportSubmitted = true; showReport = false; reportNote = ""
            } catch { errorMessage = "Could not send the report. Try again later." }
        }
    }

    func resumeAfterBackground() {
        socket.connect()
        guard !userId.isEmpty, lobbyState != nil else { return }
        socket.reconnectLobby(userId: userId)
    }

    private func persistIdentity() {
        UserDefaults.standard.set(username, forKey: "msp_username")
        UserDefaults.standard.set(userId, forKey: "msp_user_id")
        UserDefaults.standard.set(lobbyCode, forKey: "msp_lobby_code")
    }

    private func handle(_ event: SocketEvent) {
        switch event {
        case .joinResult(let result):
            userId = result.userId
            if let username = result.username { self.username = username }
            restoredAnswers.removeAll()
            selectedAnswer = nil
            persistIdentity()
        case .answersRestored(let restored):
            restoredAnswers = restored.answers
            if let question = currentQuestion { selectedAnswer = restored.answers[question.instanceId] }
        case .lobbyState(let state):
            isBusy = false
            lobbyState = state; lobbyCode = state.code; currentQuestion = state.currentQuestion; latestResolution = state.latestResolution; leaderboard = state.leaderboard
            selectedAnswer = state.currentQuestion.flatMap { restoredAnswers[$0.instanceId] }
            questionState = state.currentQuestion?.state ?? .unknown; persistIdentity()
            route = state.status == "waiting" ? .lobby : .game
        case .question(let question):
            currentQuestion = question; questionState = question.state; selectedAnswer = restoredAnswers[question.instanceId]; route = .game; soundService.play(.questionAlert)
        case .questionState(let state):
            questionState = state.state
            if var question = currentQuestion, question.instanceId == state.instanceId {
                question.state = state.state; question.answerDeadline = state.answerDeadline
                if state.state == .closed || state.state == .cancelled { currentQuestion = nil; selectedAnswer = nil }
                else { currentQuestion = question }
            }
        case .questionText(let update):
            if var question = currentQuestion, question.instanceId == update.instanceId { question.questionText = update.questionText; currentQuestion = question }
        case .resolution(let resolution):
            latestResolution = resolution; currentQuestion = nil; selectedAnswer = nil; questionState = .resolved; route = .game; soundService.play(resolution.outcome == true ? .correct : .wrong)
        case .leaderboard(let entries): leaderboard = entries
        case .snapshot(let snapshot): self.snapshot = snapshot
        case .sessions(let sessions): self.sessions = sessions; isLoadingSessions = false
        case .feed(let feed): feedStalled = feed.stalled ?? false
        case .presenceExpired(let expiry):
            isBusy = false; lobbyState = nil; currentQuestion = nil; lobbyCode = ""; route = .home
            UserDefaults.standard.removeObject(forKey: "msp_lobby_code")
            errorMessage = "You were removed from the lobby (\(expiry.reason ?? "inactive"))."
        case .error(let message):
            isBusy = false; isLoadingSessions = false; errorMessage = message
        case .simple(let event):
            if event == "connected" {
                loadSessionsIfNeeded()
                if lobbyState != nil { socket.reconnectLobby(userId: userId) }
            }
        }
    }
}
