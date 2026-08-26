import XCTest

final class LaunchTests: XCTestCase {
    func testLaunchShowsUsernameField() {
        let app = XCUIApplication()
        app.launchArguments.append("--uitest")
        app.launch()
        XCTAssertTrue(app.textFields["Username"].waitForExistence(timeout: 5))
    }
}
