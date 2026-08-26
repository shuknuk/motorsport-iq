import Foundation

enum TrackStatus: String, Codable, Sendable {
    case green = "GREEN", yellow = "YELLOW", safetyCar = "SC", virtualSafetyCar = "VSC", red = "RED", chequered = "CHEQUERED", unknown
    init(from decoder: Decoder) throws { self = TrackStatus(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown }
}

enum SessionMode: String, Codable, Sendable { case live, replay, unknown
    init(from decoder: Decoder) throws { self = SessionMode(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown }
}

enum QuestionCategory: String, Codable, Sendable { case overtake = "OVERTAKE", pitWindow = "PIT_WINDOW", gapClosing = "GAP_CLOSING", finishPosition = "FINISH_POSITION", unknown
    init(from decoder: Decoder) throws { self = QuestionCategory(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown }
}

enum Difficulty: String, Codable, Sendable { case easy = "EASY", medium = "MEDIUM", hard = "HARD", unknown
    init(from decoder: Decoder) throws { self = Difficulty(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown }
}

enum QuestionState: String, Codable, Sendable { case triggered = "TRIGGERED", live = "LIVE", locked = "LOCKED", active = "ACTIVE", resolved = "RESOLVED", explained = "EXPLAINED", closed = "CLOSED", cancelled = "CANCELLED", unknown
    init(from decoder: Decoder) throws { self = QuestionState(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .unknown }
}

struct PlayerState: Codable, Sendable, Identifiable {
    let id: String
    let username: String
    let isHost: Bool
    let connected: Bool
    let joinedAtLap: Int?
    var displayID: String { id }
    init(id: String, username: String, isHost: Bool = false, connected: Bool = true, joinedAtLap: Int? = nil) {
        self.id = id; self.username = username; self.isHost = isHost; self.connected = connected; self.joinedAtLap = joinedAtLap
    }
    enum CodingKeys: String, CodingKey { case id, username, isHost, connected, joinedAtLap }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        username = try c.decode(String.self, forKey: .username)
        isHost = try c.decodeIfPresent(Bool.self, forKey: .isHost) ?? false
        connected = try c.decodeIfPresent(Bool.self, forKey: .connected) ?? true
        joinedAtLap = try c.decodeIfPresent(Int.self, forKey: .joinedAtLap)
    }
}

struct LeaderboardEntry: Codable, Sendable, Identifiable {
    let userId: String
    let username: String
    let points: Int
    let streak: Int
    let maxStreak: Int?
    let correctAnswers: Int?
    let wrongAnswers: Int?
    let questionsAnswered: Int?
    let accuracy: Double?
    let joinedAtLap: Int?
    var id: String { userId }
    enum CodingKeys: String, CodingKey { case userId, username, points, streak, maxStreak, correctAnswers, wrongAnswers, questionsAnswered, accuracy, joinedAtLap }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        userId = try c.decodeIfPresent(String.self, forKey: .userId) ?? c.decodeIfPresent(String.self, forKey: .username) ?? UUID().uuidString
        username = try c.decodeIfPresent(String.self, forKey: .username) ?? "Player"
        points = try c.decodeIfPresent(Int.self, forKey: .points) ?? 0
        streak = try c.decodeIfPresent(Int.self, forKey: .streak) ?? 0
        maxStreak = try c.decodeIfPresent(Int.self, forKey: .maxStreak)
        correctAnswers = try c.decodeIfPresent(Int.self, forKey: .correctAnswers)
        wrongAnswers = try c.decodeIfPresent(Int.self, forKey: .wrongAnswers)
        questionsAnswered = try c.decodeIfPresent(Int.self, forKey: .questionsAnswered)
        accuracy = try c.decodeIfPresent(Double.self, forKey: .accuracy)
        joinedAtLap = try c.decodeIfPresent(Int.self, forKey: .joinedAtLap)
    }
}

struct QuestionContextDriver: Codable, Sendable, Identifiable {
    let driverNumber: Int?
    let name: String?
    let team: String?
    let position: Int?
    let interval: Double?
    let tyreCompound: String?
    let tyreAge: Int?
    let stintNumber: Int?
    let overtakeModeArmed: Bool?
    var id: Int { driverNumber ?? position ?? 0 }
}

struct QuestionContext: Codable, Sendable {
    let triggerLap: Int?
    let driver1: QuestionContextDriver?
    let driver2: QuestionContextDriver?
}

struct RaceSnapshot: Codable, Sendable {
    let sessionId: String?
    let lapNumber: Int?
    let totalLaps: Int?
    let trackStatus: TrackStatus?
    let drivers: [QuestionContextDriver]?
    let timestamp: String?
    let dataFeedStalled: Bool?
    let leaderLapTime: Double?
    let leaderLapStartTime: String?
}

struct QuestionEvent: Codable, Sendable {
    var instanceId: String
    var questionId: String?
    var questionText: String
    var category: QuestionCategory
    var difficulty: Difficulty?
    var state: QuestionState
    var windowSize: Int?
    var triggeredAt: String?
    var answerDeadline: String?
    var suggestedStatKeys: [String]?
    var questionContext: QuestionContext?
    enum CodingKeys: String, CodingKey { case instanceId, id, questionId, questionText, category, difficulty, state, windowSize, triggeredAt, answerDeadline, suggestedStatKeys, questionContext }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        instanceId = try c.decodeIfPresent(String.self, forKey: .instanceId) ?? c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        questionId = try c.decodeIfPresent(String.self, forKey: .questionId)
        questionText = try c.decodeIfPresent(String.self, forKey: .questionText) ?? "Question unavailable"
        category = try c.decodeIfPresent(QuestionCategory.self, forKey: .category) ?? .unknown
        difficulty = try c.decodeIfPresent(Difficulty.self, forKey: .difficulty)
        state = try c.decodeIfPresent(QuestionState.self, forKey: .state) ?? .unknown
        windowSize = try c.decodeIfPresent(Int.self, forKey: .windowSize)
        triggeredAt = try c.decodeIfPresent(String.self, forKey: .triggeredAt)
        answerDeadline = try c.decodeIfPresent(String.self, forKey: .answerDeadline)
        suggestedStatKeys = try c.decodeIfPresent([String].self, forKey: .suggestedStatKeys)
        questionContext = try c.decodeIfPresent(QuestionContext.self, forKey: .questionContext)
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(instanceId, forKey: .instanceId); try c.encodeIfPresent(questionId, forKey: .questionId)
        try c.encode(questionText, forKey: .questionText); try c.encode(category, forKey: .category)
        try c.encodeIfPresent(difficulty, forKey: .difficulty); try c.encode(state, forKey: .state)
        try c.encodeIfPresent(windowSize, forKey: .windowSize); try c.encodeIfPresent(triggeredAt, forKey: .triggeredAt)
        try c.encodeIfPresent(answerDeadline, forKey: .answerDeadline); try c.encodeIfPresent(suggestedStatKeys, forKey: .suggestedStatKeys)
        try c.encodeIfPresent(questionContext, forKey: .questionContext)
    }
}

struct QuestionStateEvent: Codable, Sendable {
    let instanceId: String
    let state: QuestionState
    let cancelledReason: String?
    let answerDeadline: String?
    enum CodingKeys: String, CodingKey { case instanceId, state, cancelledReason, answerDeadline }
}

struct QuestionTextUpdateEvent: Codable, Sendable {
    let instanceId: String
    let questionText: String
}

struct ResolutionEvent: Codable, Sendable {
    let instanceId: String
    let questionId: String?
    let questionText: String?
    let correctAnswer: String?
    let outcome: Bool?
    let explanation: String?
    let scores: [LeaderboardEntry]?
}

struct LobbyState: Codable, Sendable {
    let id: String
    let code: String
    let shareUrl: String?
    let hostId: String?
    let sessionId: String?
    let status: String
    let sessionMode: SessionMode?
    let replaySpeed: Double?
    let isReplayComplete: Bool?
    let isSimulation: Bool?
    let isPublic: Bool?
    let players: [PlayerState]
    let currentQuestion: QuestionEvent?
    let latestResolution: ResolutionEvent?
    let questionCount: Int?
    let minQuestions: Int?
    let maxQuestions: Int?
    let leaderboard: [LeaderboardEntry]
    let finalStandings: [LeaderboardEntry]?
    enum CodingKeys: String, CodingKey { case id, code, shareUrl, hostId, sessionId, status, sessionMode, replaySpeed, isReplayComplete, isSimulation, isPublic, players, currentQuestion, latestResolution, questionCount, minQuestions, maxQuestions, leaderboard, finalStandings }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        code = try c.decodeIfPresent(String.self, forKey: .code) ?? ""
        shareUrl = try c.decodeIfPresent(String.self, forKey: .shareUrl)
        hostId = try c.decodeIfPresent(String.self, forKey: .hostId)
        sessionId = try c.decodeIfPresent(String.self, forKey: .sessionId)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "waiting"
        sessionMode = try c.decodeIfPresent(SessionMode.self, forKey: .sessionMode)
        replaySpeed = try c.decodeIfPresent(Double.self, forKey: .replaySpeed)
        isReplayComplete = try c.decodeIfPresent(Bool.self, forKey: .isReplayComplete)
        isSimulation = try c.decodeIfPresent(Bool.self, forKey: .isSimulation)
        isPublic = try c.decodeIfPresent(Bool.self, forKey: .isPublic)
        players = try c.decodeIfPresent([PlayerState].self, forKey: .players) ?? []
        currentQuestion = try c.decodeIfPresent(QuestionEvent.self, forKey: .currentQuestion)
        latestResolution = try c.decodeIfPresent(ResolutionEvent.self, forKey: .latestResolution)
        questionCount = try c.decodeIfPresent(Int.self, forKey: .questionCount)
        minQuestions = try c.decodeIfPresent(Int.self, forKey: .minQuestions)
        maxQuestions = try c.decodeIfPresent(Int.self, forKey: .maxQuestions)
        leaderboard = try c.decodeIfPresent([LeaderboardEntry].self, forKey: .leaderboard) ?? []
        finalStandings = try c.decodeIfPresent([LeaderboardEntry].self, forKey: .finalStandings)
    }
}

struct RaceSnapshotEvent: Codable, Sendable {
    let sessionId: String?
    let lapNumber: Int?
    let totalLaps: Int?
    let trackStatus: TrackStatus?
    let sessionMode: SessionMode?
    let replaySpeed: Double?
    let isReplayComplete: Bool?
    let timestamp: String?
    let leaderLapTime: Double?
    let leaderLapStartTime: String?
    let leader: String?
    let topThree: [String]?
    let topThreePositions: [Int]?
    let dataFeedStalled: Bool?
    let localYellowSectors: [Int]?
    let globalYellowActive: Bool?
}

struct SessionInfo: Codable, Sendable, Identifiable {
    let sessionKey: Int?
    let meetingKey: Int?
    let location: String?
    let sessionType: String?
    let sessionName: String?
    let circuitShortName: String?
    let countryName: String?
    let dateStart: String?
    let dateEnd: String?
    let year: Int?
    let isCancelled: Bool?
    let isCompleted: Bool?
    let isLive: Bool?
    let isPreRace: Bool?
    let mode: SessionMode?
    var id: String { sessionKey.map(String.init) ?? UUID().uuidString }
    enum CodingKeys: String, CodingKey { case sessionKey = "session_key", meetingKey = "meeting_key", location, sessionType = "session_type", sessionName = "session_name", circuitShortName = "circuit_short_name", countryName = "country_name", dateStart = "date_start", dateEnd = "date_end", year, isCancelled = "is_cancelled", isCompleted, isLive, isPreRace, mode }
}

struct FeedStatus: Codable, Sendable {
    let stalled: Bool?
    let status: String?
    let message: String?
}

struct JoinResult: Codable, Sendable {
    let userId: String
    let username: String?
}

struct AnswersRestored: Codable, Sendable {
    let answers: [String: String]
}

struct PresenceExpired: Codable, Sendable {
    let reason: String?
}

enum SocketEvent: Sendable {
    case joinResult(JoinResult)
    case answersRestored(AnswersRestored)
    case presenceExpired(PresenceExpired)
    case lobbyState(LobbyState)
    case question(QuestionEvent)
    case questionState(QuestionStateEvent)
    case questionText(QuestionTextUpdateEvent)
    case resolution(ResolutionEvent)
    case leaderboard([LeaderboardEntry])
    case snapshot(RaceSnapshotEvent)
    case sessions([SessionInfo])
    case feed(FeedStatus)
    case error(String)
    case simple(String)
}
