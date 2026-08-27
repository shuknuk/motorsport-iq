import SwiftUI

@main
struct MotorsportIQApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.resumeAfterBackground() }
                }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            switch model.route {
            case .home: HomeView()
            case .lobby: LobbyView()
            case .game: GameView()
            }
        }
        .tint(.raceRed)
        .alert("Motorsport IQ", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("OK") { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "")
        }
    }
}

extension Color {
    static let raceBackground = Color(red: 0.027, green: 0.035, blue: 0.051)
    static let racePanel = Color(red: 0.071, green: 0.086, blue: 0.122)
    static let raceElevated = Color(red: 0.102, green: 0.122, blue: 0.169)
    static let raceRed = Color(red: 1, green: 0.129, blue: 0.078)
    static let raceGreen = Color(red: 0.122, green: 0.824, blue: 0.478)
    static let raceWarning = Color(red: 1, green: 0.76, blue: 0.12)
    static let raceMuted = Color(red: 0.604, green: 0.651, blue: 0.722)
}

struct RaceScreen<Content: View>: View {
    let title: String
    let trailingAction: (() -> Void)?
    @ViewBuilder let content: () -> Content

    init(title: String, trailingAction: (() -> Void)? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.trailingAction = trailingAction
        self.content = content
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) { content() }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                    .frame(maxWidth: 760)
                    .frame(maxWidth: .infinity)
            }
            .background(Color.raceBackground.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.raceBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                if let trailingAction {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Leave", role: .destructive, action: trailingAction)
                            .accessibilityLabel("Leave race")
                    }
                }
            }
        }
    }
}

struct RacePanel<Content: View>: View {
    let padding: CGFloat
    @ViewBuilder let content: () -> Content

    init(padding: CGFloat = 16, @ViewBuilder content: @escaping () -> Content) {
        self.padding = padding
        self.content = content
    }

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(.white.opacity(0.08), lineWidth: 1)
            }
    }
}

struct HomeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        RaceScreen(title: "Motorsport IQ") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Rectangle()
                        .fill(Color.raceRed)
                        .frame(width: 4, height: 18)
                    Text("LIVE F1 PREDICTIONS")
                        .font(.caption.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(Color.raceRed)
                }
                Text("Read the race.\nBeat your mates.")
                    .font(.system(.largeTitle, design: .rounded).weight(.black))
                    .tracking(-0.8)
                    .lineSpacing(-2)
                Text("A watch-party game for people who actually watch the race.")
                    .font(.body)
                    .foregroundStyle(Color.raceMuted)
            }

            RacePanel {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Join a race")
                            .font(.title3.bold())
                        Text("Create a lobby or enter a code from a friend.")
                            .font(.subheadline)
                            .foregroundStyle(Color.raceMuted)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Driver name")
                            .font(.subheadline.weight(.semibold))
                        TextField("Your name", text: $model.username)
                            .textInputAutocapitalization(.words)
                            .textFieldStyle(.plain)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 50)
                            .background(Color.raceElevated, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .accessibilityLabel("Driver name")
                    }

                    Button(model.isBusy ? "Working…" : "Create lobby", action: model.createLobby)
                        .buttonStyle(RaceButtonStyle())
                        .disabled(model.isBusy)

                    HStack(spacing: 10) {
                        Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
                        Text("OR")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.raceMuted)
                        Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Lobby code")
                            .font(.subheadline.weight(.semibold))
                        HStack(spacing: 8) {
                            TextField("ABC123", text: $model.lobbyCode)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .textFieldStyle(.plain)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 50)
                                .background(Color.raceElevated, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .accessibilityLabel("Lobby code")
                            Button(model.isBusy ? "Working…" : "Join", action: model.joinLobby)
                                .buttonStyle(RaceButtonStyle())
                                .frame(maxWidth: 110)
                                .disabled(model.isBusy)
                        }
                    }
                }
            }

            Toggle("Question sounds", isOn: $model.soundsEnabled)
                .tint(Color.raceRed)
                .padding(.horizontal, 4)

            if !model.sessions.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Practice a replay")
                        .font(.title3.bold())
                    RacePanel(padding: 12) {
                        VStack(spacing: 12) {
                            Picker("Replay speed", selection: $model.replaySpeed) {
                                Text("1x").tag(1.0)
                                Text("10x").tag(10.0)
                            }
                            .pickerStyle(.segmented)
                            .accessibilityLabel("Replay speed")

                            ForEach(model.sessions) { session in
                                Button {
                                    model.joinSolo(session)
                                } label: {
                                    HStack(spacing: 12) {
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(session.sessionName ?? session.location ?? "Race session")
                                                .font(.headline)
                                                .foregroundStyle(.white)
                                            Text(session.countryName ?? "OpenF1 replay")
                                                .font(.subheadline)
                                                .foregroundStyle(Color.raceMuted)
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(Color.raceMuted)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .disabled(model.isBusy)
                            }
                        }
                    }
                }
            } else if model.isLoadingSessions {
                Label(
                    model.isCheckingRenderConnection ? "Checking Render connection live…" : "Loading race sessions…",
                    systemImage: model.isCheckingRenderConnection ? "antenna.radiowaves.left.and.right" : "arrow.triangle.2.circlepath"
                )
                    .foregroundStyle(Color.raceMuted)
            }
        }
        .task { model.loadSessionsIfNeeded() }
    }
}

struct RaceButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .frame(minHeight: 48)
            .frame(maxWidth: .infinity)
            .foregroundStyle(.white)
            .opacity(configuration.isPressed ? 0.78 : 1)
            .background(Color.raceRed, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct LobbyView: View {
    @Environment(AppModel.self) private var model
    @State private var selectedSessionID = ""

    var body: some View {
        RaceScreen(title: "Lobby") {
            if let lobby = model.lobbyState {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("LOBBY CODE")
                                .font(.caption.weight(.bold))
                                .tracking(1.1)
                                .foregroundStyle(Color.raceMuted)
                            Text(lobby.code)
                                .font(.system(size: 40, weight: .black, design: .monospaced))
                                .tracking(5)
                        }
                        Spacer()
                        if let url = lobby.shareUrl, let shareURL = URL(string: url) {
                            ShareLink(item: shareURL) {
                                Label("Share", systemImage: "square.and.arrow.up")
                            }
                            .labelStyle(.iconOnly)
                            .frame(minWidth: 44, minHeight: 44)
                            .accessibilityLabel("Share lobby")
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(.white.opacity(0.08), lineWidth: 1)
                }

                VStack(alignment: .leading, spacing: 0) {
                    Text("Players")
                        .font(.title3.bold())
                        .padding(.bottom, 8)
                    ForEach(Array(lobby.players.enumerated()), id: \.element.id) { index, player in
                        if index > 0 { Divider().overlay(.white.opacity(0.08)) }
                        HStack(spacing: 10) {
                            Circle()
                                .fill(player.connected ? Color.raceGreen : Color.raceMuted)
                                .frame(width: 8, height: 8)
                            Text(player.username)
                            if player.id == model.userId {
                                Text("YOU")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(Color.raceRed)
                            }
                            Spacer()
                            if player.isHost {
                                Image(systemName: "crown.fill")
                                    .foregroundStyle(.yellow)
                                    .accessibilityLabel("Host")
                            }
                        }
                        .frame(minHeight: 44)
                    }
                }
                .padding(.horizontal, 4)

                if lobby.hostId == model.userId || lobby.players.first(where: { $0.id == model.userId })?.isHost == true {
                    if !model.sessions.isEmpty {
                        Picker("Session", selection: $selectedSessionID) {
                            ForEach(model.sessions) { session in
                                Text(session.sessionName ?? session.location ?? "Race session").tag(session.sessionKey.map(String.init) ?? "")
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(minHeight: 44)
                    }
                    Button("Start race") { model.startSession(sessionID: selectedSessionID.isEmpty ? nil : selectedSessionID) }
                        .buttonStyle(RaceButtonStyle())
                        .disabled(model.isBusy || (model.sessions.isEmpty && lobby.sessionId == nil))
                } else {
                    Label("Waiting for the host to start", systemImage: "hourglass")
                        .foregroundStyle(Color.raceMuted)
                        .frame(maxWidth: .infinity)
                }
                Button("Leave lobby", role: .destructive, action: model.leaveLobby)
                    .frame(maxWidth: .infinity, minHeight: 44)
            } else {
                RacePanel {
                    ProgressView("Connecting…")
                }
            }
        }
        .task { model.loadSessionsIfNeeded() }
        .onAppear { selectedSessionID = selectedSessionID.isEmpty ? (model.lobbyState?.sessionId ?? model.sessions.first?.sessionKey.map(String.init) ?? "") : selectedSessionID }
        .task {
            while !Task.isCancelled {
                model.socket.presencePing()
                try? await Task.sleep(for: .seconds(90))
            }
        }
    }
}

struct GameView: View {
    @Environment(AppModel.self) private var model
    @State private var showLeaveConfirmation = false

    var body: some View {
        let standings = model.lobbyState?.finalStandings ?? model.leaderboard
        RaceScreen(title: model.lobbyState?.code ?? "Race", trailingAction: { showLeaveConfirmation = true }) {
            RaceHUD(snapshot: model.snapshot)
            if model.feedStalled {
                Label("Race feed delayed", systemImage: "wifi.exclamationmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.raceWarning)
            }
            if let question = model.currentQuestion {
                let questionState = question.state
                RacePanel {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(question.category.rawValue.replacingOccurrences(of: "_", with: " "))
                                .font(.caption.weight(.bold))
                                .tracking(1)
                                .foregroundStyle(Color.raceRed)
                            Spacer()
                            if let deadline = question.answerDeadline { CountdownView(deadline: deadline) }
                        }
                        Text(question.questionText)
                            .font(.title2.bold())
                            .fixedSize(horizontal: false, vertical: true)
                        if let context = question.questionContext, let lap = context.triggerLap {
                            Text("Triggered on lap \(lap)")
                                .font(.subheadline)
                                .foregroundStyle(Color.raceMuted)
                        }
                        if questionState == .live {
                            HStack(spacing: 12) {
                                AnswerButton(title: "YES", color: Color.raceGreen, disabled: model.selectedAnswer != nil) { model.submitAnswer("YES") }
                                AnswerButton(title: "NO", color: Color.raceRed, disabled: model.selectedAnswer != nil) { model.submitAnswer("NO") }
                            }
                        } else if questionState.isAwaitingResolution {
                            Label("Waiting for final answer…", systemImage: "hourglass")
                                .font(.headline)
                                .foregroundStyle(Color.raceMuted)
                                .frame(maxWidth: .infinity, minHeight: 48)
                        }
                        if let selected = model.selectedAnswer {
                            Label("Answer submitted: \(selected)", systemImage: "checkmark.circle.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color.raceMuted)
                        }
                    }
                }
            } else {
                RacePanel {
                    Label("Waiting for the next question…", systemImage: "clock")
                        .foregroundStyle(Color.raceMuted)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
            }

            if let resolution = model.latestResolution {
                RacePanel {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(
                            resolution.outcome == true ? "Correct" : "Resolution",
                            systemImage: resolution.outcome == true ? "checkmark.circle.fill" : "xmark.circle.fill"
                        )
                        .font(.title3.bold())
                        .foregroundStyle(resolution.outcome == true ? Color.raceGreen : Color.raceRed)
                        if let explanation = resolution.explanation {
                            Text(explanation)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Leaderboard")
                        .font(.title3.bold())
                    Spacer()
                    if model.lobbyState?.status == "finished" {
                        Text("Race complete")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Color.raceGreen)
                    }
                }
                RacePanel(padding: 12) {
                    if standings.isEmpty {
                        Text("Scores will appear after the first answer.")
                            .foregroundStyle(Color.raceMuted)
                            .frame(minHeight: 44, alignment: .leading)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(standings.enumerated()), id: \.element.id) { index, entry in
                                if index > 0 { Divider().overlay(.white.opacity(0.08)) }
                                HStack(spacing: 12) {
                                    Text("\(index + 1)")
                                        .font(.headline.monospacedDigit())
                                        .foregroundStyle(Color.raceMuted)
                                        .frame(width: 28)
                                    Text(entry.username)
                                        .fontWeight(entry.userId == model.userId ? .bold : .regular)
                                        .lineLimit(1)
                                    Spacer()
                                    Text("\(entry.points) pts")
                                        .font(.headline.monospacedDigit())
                                }
                                .frame(minHeight: 44)
                            }
                        }
                    }
                }
            }

            Button { model.showReport = true } label: {
                Label("Report a problem", systemImage: "exclamationmark.bubble")
                    .frame(minHeight: 44, alignment: .leading)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.raceMuted)
        }
        .sheet(isPresented: Binding(get: { model.showReport }, set: { model.showReport = $0 })) { ReportView() }
        .confirmationDialog("Leave this race?", isPresented: $showLeaveConfirmation) {
            Button("Leave race", role: .destructive, action: model.leaveLobby)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your current race session will end on this device.")
        }
        .task {
            while !Task.isCancelled {
                model.socket.presencePing()
                try? await Task.sleep(for: .seconds(90))
            }
        }
    }
}

struct ReportView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Picker("Reason", selection: $model.reportReason) {
                    ForEach(ReportReason.allCases, id: \.self) { reason in Text(reason.rawValue.replacingOccurrences(of: "_", with: " ")).tag(reason) }
                }
                TextField("Optional note", text: $model.reportNote, axis: .vertical)
                    .lineLimit(4, reservesSpace: true)
                Button("Send report") { model.submitReport(); dismiss() }
            }
            .navigationTitle("Report a problem")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}

struct AnswerButton: View {
    let title: String
    let color: Color
    let disabled: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .frame(maxWidth: .infinity, minHeight: 56)
                .font(.title3.bold())
        }
        .buttonStyle(AnswerButtonStyle(color: color, disabled: disabled))
        .disabled(disabled)
    }
}

struct AnswerButtonStyle: ButtonStyle {
    let color: Color
    let disabled: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.white)
            .opacity(disabled ? 0.42 : configuration.isPressed ? 0.78 : 1)
            .background(color, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct CountdownView: View {
    let deadline: String
    var body: some View {
        let deadlineDate = Self.date(from: deadline)
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let seconds = max(0, Int((deadlineDate?.timeIntervalSince(context.date) ?? 0).rounded(.up)))
            Text("\(seconds)s")
                .font(.headline.monospacedDigit())
                .foregroundStyle(seconds <= 10 ? Color.raceRed : .white)
                .accessibilityLabel("\(seconds) seconds remaining")
        }
    }
    static func date(from string: String) -> Date? {
        if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(string) { return date }
        return try? Date.ISO8601FormatStyle().parse(string)
    }
}

struct RaceHUD: View {
    let snapshot: RaceSnapshotEvent?
    var body: some View {
        RacePanel(padding: 14) {
            VStack(spacing: 10) {
                HStack {
                    Label("Lap \(snapshot?.lapNumber ?? 0)/\(snapshot?.totalLaps ?? 0)", systemImage: "flag.checkered")
                    Spacer()
                    Text(snapshot?.trackStatus?.rawValue ?? "WAITING")
                        .font(.caption.bold())
                        .tracking(0.8)
                        .foregroundStyle(snapshot?.trackStatus == .green ? Color.raceGreen : Color.raceMuted)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.raceMuted)

                if let leader = snapshot?.leader, !leader.isEmpty {
                    Divider().overlay(.white.opacity(0.08))
                    HStack(spacing: 8) {
                        Label("P1", systemImage: "flag.fill")
                            .foregroundStyle(Color.raceRed)
                        Text(leader)
                            .fontWeight(.bold)
                            .lineLimit(1)
                        Spacer()
                        if let topThree = snapshot?.topThree {
                            Text(topThree.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(Color.raceMuted)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
    }
}
