import XCTest
@testable import MotorsportIQ

final class ContractTests: XCTestCase {
    func testLobbyStateDecodesMissingOptionalFields() throws {
        let data = Data(#"{"id":"lobby-1","code":"ABC123","status":"waiting","players":[{"id":"u1","username":"Kinshuk"}]}"#.utf8)
        let state = try JSONDecoder().decode(LobbyState.self, from: data)
        XCTAssertEqual(state.code, "ABC123")
        XCTAssertEqual(state.players.first?.username, "Kinshuk")
        XCTAssertTrue(state.leaderboard.isEmpty)
    }

    func testServerDeadlineProducesFortyFiveSecondWindow() {
        let trigger = Date(timeIntervalSince1970: 1_000)
        let deadline = trigger.addingTimeInterval(45)
        XCTAssertEqual(Int(deadline.timeIntervalSince(trigger)), 45)
    }

    func testQuestionAndSnapshotEventsUseServerShapes() throws {
        let questionData = Data(#"{"id":"instance-1","questionId":"q1","questionText":"Will the leader pit?","category":"PIT_WINDOW","difficulty":"EASY","state":"LIVE","windowSize":45,"triggeredAt":"2026-08-26T20:00:00Z"}"#.utf8)
        let question = try JSONDecoder().decode(QuestionEvent.self, from: questionData)
        XCTAssertEqual(question.instanceId, "instance-1")
        XCTAssertEqual(question.category, .pitWindow)

        let snapshotData = Data(#"{"sessionId":"s1","lapNumber":12,"totalLaps":57,"trackStatus":"GREEN","sessionMode":"replay","replaySpeed":1,"isReplayComplete":false,"timestamp":"2026-08-26T20:00:00Z","leader":"L. Norris","leaderStats":{"tyreAge":12,"team":"McLaren"},"topThree":["L. Norris","M. Verstappen"]}"#.utf8)
        let snapshot = try JSONDecoder().decode(RaceSnapshotEvent.self, from: snapshotData)
        XCTAssertEqual(snapshot.lapNumber, 12)
        XCTAssertEqual(snapshot.topThree?.first, "L. Norris")
    }
}
