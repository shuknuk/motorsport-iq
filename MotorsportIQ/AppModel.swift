import Foundation
import Observation

enum AppRoute: Sendable { case home, lobby, game }
enum ReportReason: String, CaseIterable, Sendable { case wrongAnswer = "WRONG_ANSWER", badExplanation = "BAD_EXPLANATION", unclearQuestion = "UNCLEAR_QUESTION", telemetryMismatch = "TELEMETRY_MISMATCH", other = "OTHER" }

@MainActor
@Observable
final class AppModel {
    let socket: SocketService
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
    var selectedAnswer: String?
    var isBusy = false
    var errorMessage: String?
    var showReport = false
    var reportReason: ReportReason = .other
    var reportNote = ""
    var reportSubmitted = false

    init(socket: SocketService = SocketService()) {
        self.socket = socket
        socket.onEvent = { [weak self] event in self?.handle(event) }
        socket.connect()
        if !lobbyCode.isEmpty {
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(500))
                guard let self, !self.userId.isEmpty else { return }
                self.socket.reconnectLobby(userId: self.userId)
            }
        }
    }

    func createLobby() {
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { errorMessage = "Enter a username first."; return }
        persistIdentity(); isBusy = true; socket.createLobby(username: username)
    }

    func joinLobby() {
        let code = lobbyCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { errorMessage = "Enter a username first."; return }
        guard !code.isEmpty else { errorMessage = "Enter a lobby code."; return }
        lobbyCode = code; persistIdentity(); isBusy = true; socket.joinLobby(code: code, username: username, restoreUserId: userId)
    }

    func joinSolo(_ session: SessionInfo) {
        guard let key = session.sessionKey.map(String.init), !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { errorMessage = "Enter a username first."; return }
        persistIdentity(); isBusy = true; socket.joinSolo(username: username, sessionKey: key, restoreUserId: userId)
    }

    func startSession(sessionID overrideSessionID: String? = nil) {
        guard let lobby = lobbyState else { return }
        let sessionID = overrideSessionID ?? lobby.sessionId ?? sessions.first?.sessionKey.map(String.init)
        guard let sessionID else { return }
        socket.startSession(lobbyId: lobby.id, sessionId: sessionID, userId: userId, replaySpeed: lobby.replaySpeed)
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
        isBusy = false
        switch event {
        case .joinResult(let result):
            userId = result.userId
            if let username = result.username { self.username = username }
            persistIdentity()
        case .answersRestored(let restored):
            if let question = currentQuestion { selectedAnswer = restored.answers[question.instanceId] }
        case .lobbyState(let state):
            lobbyState = state; lobbyCode = state.code; currentQuestion = state.currentQuestion; latestResolution = state.latestResolution; leaderboard = state.leaderboard
            questionState = state.currentQuestion?.state ?? .unknown; persistIdentity()
            route = state.status == "waiting" ? .lobby : .game
        case .question(let question):
            currentQuestion = question; questionState = question.state; selectedAnswer = nil; route = .game
        case .questionState(let state):
            questionState = state.state
            if var question = currentQuestion, question.instanceId == state.instanceId { question.state = state.state; question.answerDeadline = state.answerDeadline; currentQuestion = question }
        case .questionText(let update):
            if var question = currentQuestion, question.instanceId == update.instanceId { question.questionText = update.questionText; currentQuestion = question }
        case .resolution(let resolution): latestResolution = resolution; route = .game
        case .leaderboard(let entries): leaderboard = entries
        case .snapshot(let snapshot): self.snapshot = snapshot
        case .sessions(let sessions): self.sessions = sessions
        case .feed(let feed): feedStalled = feed.stalled ?? false
        case .presenceExpired(let expiry):
            route = .home; errorMessage = "You were removed from the lobby (\(expiry.reason ?? "inactive"))."
        case .error(let message):
            if !message.localizedCaseInsensitiveContains("connect") { errorMessage = message }
        case .simple(let event):
            if event == "connected" {
                socket.getSessions()
                if lobbyState != nil { socket.reconnectLobby(userId: userId) }
            }
        }
    }
}
