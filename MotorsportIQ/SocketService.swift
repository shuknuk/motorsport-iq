import Foundation
import SocketIO

@MainActor
final class SocketService {
    let baseURL: URL
    private let manager: SocketManager
    private let socket: SocketIOClient
    private var pendingEmits: [(String, [String: Any])] = []
    var onEvent: ((SocketEvent) -> Void)?

    var isConnected: Bool { socket.status == .connected }

    init(baseURL: URL = SocketService.defaultURL) {
        self.baseURL = baseURL
        manager = SocketManager(socketURL: baseURL, config: [.log(false), .compress, .reconnects(true), .reconnectAttempts(-1), .reconnectWait(1), .forceNew(true)])
        socket = manager.defaultSocket
        registerHandlers()
    }

    static var defaultURL: URL {
        URL(string: Bundle.main.object(forInfoDictionaryKey: "SOCKET_URL") as? String ?? "http://localhost:4000")!
    }

    func connect() { socket.connect() }
    func disconnect() { socket.disconnect() }

    func createLobby(username: String, sessionId: String? = nil) {
        emit("create_lobby", values: ["username": username, "sessionId": sessionId])
    }

    func joinLobby(code: String, username: String, restoreUserId: String? = nil) {
        emit("join_lobby", values: ["lobbyCode": code, "username": username, "restoreUserId": restoreUserId])
    }

    func joinSolo(username: String, sessionKey: String, restoreUserId: String? = nil, replaySpeed: Double? = nil) {
        emit("join_solo", values: ["username": username, "sessionKey": sessionKey, "restoreUserId": restoreUserId, "replaySpeed": replaySpeed])
    }

    func startSession(lobbyId: String, sessionId: String, userId: String? = nil, replaySpeed: Double? = nil) {
        emit("start_session", values: ["lobbyId": lobbyId, "sessionId": sessionId, "userId": userId, "replaySpeed": replaySpeed])
    }

    func submitAnswer(instanceId: String, answer: String) { emit("submit_answer", values: ["instanceId": instanceId, "answer": answer]) }
    func reconnectLobby(userId: String, force: Bool = false) { emit("reconnect_lobby", values: ["userId": userId, "force": force]) }
    func leaveLobby() { socket.emit("leave_lobby") }
    func presencePing() { socket.emit("presence_ping") }
    func getSessions(year: Int? = nil) { emit("get_sessions", values: ["year": year]) }

    private func emit(_ event: String, values: [String: Any?]) {
        let payload = values.reduce(into: [String: Any]()) { result, item in
            if let value = item.value { result[item.key] = value }
        }
        guard socket.status == .connected else {
            pendingEmits.append((event, payload))
            socket.connect()
            return
        }
        socket.emit(event, payload)
    }

    private func registerHandlers() {
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            Task { @MainActor [weak self] in self?.flushPending() }
        }
        socket.on(clientEvent: .statusChange) { [weak self] values, _ in
            guard let status = values.first as? SocketIOStatus else { return }
            Task { @MainActor [weak self] in
                guard let self else { return }
                if status == .connecting { self.onEvent?(.simple("connecting")) }
            }
        }
        let events = ["lobby_state", "question_event", "question_state", "question_text_update", "resolution_event", "leaderboard_update", "race_snapshot_update", "sessions_list", "feed_status", "error", "session_started", "question_locked", "question_cancelled", "answers_restored", "join_result", "presence_expired"]
        for event in events {
            socket.on(event) { [weak self] values, _ in
                guard let self, let data = Self.payloadData(values.first) else { return }
                Task { @MainActor in self.route(event: event, data: data) }
            }
        }
    }

    private func route(event: String, data: Data) {
        let decoder = JSONDecoder()
        do {
            switch event {
            case "join_result": onEvent?(.joinResult(try decoder.decode(JoinResult.self, from: data)))
            case "answers_restored": onEvent?(.answersRestored(try decoder.decode(AnswersRestored.self, from: data)))
            case "presence_expired": onEvent?(.presenceExpired(try decoder.decode(PresenceExpired.self, from: data)))
            case "lobby_state": onEvent?(.lobbyState(try decoder.decode(LobbyState.self, from: data)))
            case "question_event": onEvent?(.question(try decoder.decode(QuestionEvent.self, from: data)))
            case "question_state": onEvent?(.questionState(try decoder.decode(QuestionStateEvent.self, from: data)))
            case "question_locked": onEvent?(.questionState(QuestionStateEvent(instanceId: try Self.stringValue("instanceId", from: data), state: .locked, cancelledReason: nil, answerDeadline: nil)))
            case "question_cancelled": onEvent?(.questionState(QuestionStateEvent(instanceId: try Self.stringValue("instanceId", from: data), state: .cancelled, cancelledReason: nil, answerDeadline: nil)))
            case "question_text_update": onEvent?(.questionText(try decoder.decode(QuestionTextUpdateEvent.self, from: data)))
            case "resolution_event": onEvent?(.resolution(try decoder.decode(ResolutionEvent.self, from: data)))
            case "leaderboard_update": onEvent?(.leaderboard(try decoder.decode([LeaderboardEntry].self, from: data)))
            case "race_snapshot_update": onEvent?(.snapshot(try decoder.decode(RaceSnapshotEvent.self, from: data)))
            case "sessions_list": onEvent?(.sessions(try decoder.decode([SessionInfo].self, from: data)))
            case "feed_status": onEvent?(.feed(try decoder.decode(FeedStatus.self, from: data)))
            case "error":
                let payload = Self.errorPayload(from: data)
                onEvent?(.error(payload.message, code: payload.code))
            default: onEvent?(.simple(event))
            }
        } catch {
            onEvent?(.error("Could not read \(event): \(error.localizedDescription)", code: nil))
        }
    }

    private static func payloadData(_ value: Any?) -> Data? {
        guard let value else { return nil }
        if let data = value as? Data { return data }
        if let string = value as? String { return Data(string.utf8) }
        if JSONSerialization.isValidJSONObject(value) { return try? JSONSerialization.data(withJSONObject: value) }
        return nil
    }

    private static func errorPayload(from data: Data) -> (message: String, code: String?) {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return (String(data: data, encoding: .utf8) ?? "Socket error", nil)
        }
        return (
            (json["message"] as? String) ?? (json["error"] as? String) ?? "Socket error",
            json["code"] as? String
        )
    }

    private func flushPending() {
        let pending = pendingEmits
        pendingEmits.removeAll()
        pending.forEach { socket.emit($0.0, $0.1) }
        onEvent?(.simple("connected"))
    }

    private static func stringValue(_ key: String, from data: Data) throws -> String {
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let value = object?[key] as? String else { throw NSError(domain: "SocketService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing \(key)"]) }
        return value
    }
}
