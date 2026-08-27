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
    static let raceMuted = Color(red: 0.604, green: 0.651, blue: 0.722)
}

struct RaceScreen<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) { content() }
                    .padding(20)
            }
            .background(Color.raceBackground.ignoresSafeArea())
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct HomeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        RaceScreen(title: "Motorsport IQ") {
            VStack(alignment: .leading, spacing: 8) {
                Text("RACE NIGHT")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.raceRed)
                Text("Predict the race.")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                Text("Join a lobby and answer live Formula 1 questions before the clock runs out.")
                    .foregroundStyle(Color.raceMuted)
            }

            VStack(spacing: 12) {
                Toggle("Question sounds", isOn: $model.soundsEnabled)
                    .tint(Color.raceRed)
                TextField("Your username", text: $model.username)
                    .textInputAutocapitalization(.words)
                    .padding(14)
                    .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityLabel("Username")
                Button(model.isBusy ? "Working…" : "Create lobby", action: model.createLobby)
                    .buttonStyle(RaceButtonStyle())
                    .disabled(model.isBusy)
                HStack {
                    TextField("Lobby code", text: $model.lobbyCode)
                        .textInputAutocapitalization(.characters)
                        .padding(14)
                        .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 12))
                    Button(model.isBusy ? "Working…" : "Join", action: model.joinLobby)
                        .buttonStyle(RaceButtonStyle())
                        .disabled(model.isBusy)
                }
            }

            if !model.sessions.isEmpty {
                Picker("Replay speed", selection: $model.replaySpeed) {
                    Text("1x").tag(1.0)
                    Text("10x").tag(10.0)
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("Replay speed")
            } else if model.isLoadingSessions {
                Label(
                    model.isCheckingRenderConnection ? "Checking Render connection live…" : "Loading race sessions…",
                    systemImage: model.isCheckingRenderConnection ? "antenna.radiowaves.left.and.right" : "arrow.triangle.2.circlepath"
                )
                    .foregroundStyle(Color.raceMuted)
            }

            if !model.sessions.isEmpty {
                Text("Solo replay")
                    .font(.title3.bold())
                ForEach(model.sessions) { session in
                    Button {
                        model.joinSolo(session)
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(session.sessionName ?? session.location ?? "Race session")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                                Text(session.countryName ?? "OpenF1 replay")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.raceMuted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .padding(14)
                        .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .disabled(model.isBusy)
                }
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
            .background(configuration.isPressed ? Color.raceRed.opacity(0.7) : Color.raceRed, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct LobbyView: View {
    @Environment(AppModel.self) private var model
    @State private var selectedSessionID = ""

    var body: some View {
        RaceScreen(title: "Lobby") {
            if let lobby = model.lobbyState {
                VStack(alignment: .leading, spacing: 8) {
                    Text("LOBBY CODE").font(.caption.weight(.bold)).foregroundStyle(Color.raceMuted)
                    Text(lobby.code).font(.system(size: 40, weight: .black, design: .monospaced)).tracking(5)
                    if let url = lobby.shareUrl, let shareURL = URL(string: url) { ShareLink(item: shareURL) { Label("Share lobby", systemImage: "square.and.arrow.up") } }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 16))

                Text("Players").font(.title3.bold())
                ForEach(lobby.players) { player in
                    HStack {
                        Circle().fill(player.connected ? Color.raceGreen : Color.raceMuted).frame(width: 9, height: 9)
                        Text(player.username)
                        if player.id == model.userId { Text("YOU").font(.caption2.bold()).foregroundStyle(Color.raceRed) }
                        Spacer()
                        if player.isHost { Image(systemName: "crown.fill").foregroundStyle(.yellow) }
                    }
                    .padding(12)
                    .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 10))
                }

                if lobby.hostId == model.userId || lobby.players.first(where: { $0.id == model.userId })?.isHost == true {
                    if !model.sessions.isEmpty {
                        Picker("Session", selection: $selectedSessionID) {
                            ForEach(model.sessions) { session in
                                Text(session.sessionName ?? session.location ?? "Race session").tag(session.sessionKey.map(String.init) ?? "")
                            }
                        }
                        .pickerStyle(.menu)
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
                    .frame(maxWidth: .infinity)
            } else {
                ProgressView("Connecting…")
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

    var body: some View {
        let standings = model.lobbyState?.finalStandings ?? model.leaderboard
        RaceScreen(title: model.lobbyState?.code ?? "Race") {
            RaceHUD(snapshot: model.snapshot)
            if model.feedStalled { Label("Race feed delayed", systemImage: "wifi.exclamationmark").foregroundStyle(.yellow) }
            if let question = model.currentQuestion {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text(question.category.rawValue.replacingOccurrences(of: "_", with: " "))
                            .font(.caption.bold()).foregroundStyle(Color.raceRed)
                        Spacer()
                        if let deadline = question.answerDeadline { CountdownView(deadline: deadline) }
                    }
                    Text(question.questionText).font(.title2.bold())
                    if let context = question.questionContext, let lap = context.triggerLap { Text("Triggered on lap \(lap)").foregroundStyle(Color.raceMuted) }
                    HStack(spacing: 12) {
                        AnswerButton(title: "YES", color: Color.raceGreen, disabled: model.selectedAnswer != nil || !canAnswer(question)) { model.submitAnswer("YES") }
                        AnswerButton(title: "NO", color: Color.raceRed, disabled: model.selectedAnswer != nil || !canAnswer(question)) { model.submitAnswer("NO") }
                    }
                    if let selected = model.selectedAnswer { Text("Answer submitted: \(selected)").font(.subheadline).foregroundStyle(Color.raceMuted) }
                }
                .padding(16)
                .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 16))
            } else {
                Text("Waiting for the next question…").foregroundStyle(Color.raceMuted)
            }

            if let resolution = model.latestResolution {
                VStack(alignment: .leading, spacing: 8) {
                    Text(resolution.outcome == true ? "Correct" : "Resolution")
                        .font(.title3.bold())
                        .foregroundStyle(resolution.outcome == true ? Color.raceGreen : Color.raceRed)
                    if let explanation = resolution.explanation { Text(explanation) }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.raceElevated, in: RoundedRectangle(cornerRadius: 16))
            }

            Text("Leaderboard").font(.title3.bold())
            if model.lobbyState?.status == "finished" { Text("Race complete").font(.title2.bold()).foregroundStyle(Color.raceGreen) }
            ForEach(Array(standings.enumerated()), id: \.element.id) { index, entry in
                HStack {
                    Text("\(index + 1)").font(.headline.monospacedDigit()).foregroundStyle(Color.raceMuted).frame(width: 28)
                    Text(entry.username).fontWeight(entry.userId == model.userId ? .bold : .regular)
                    Spacer()
                    Text("\(entry.points) pts").font(.headline.monospacedDigit())
                }
                .padding(12)
                .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 10))
            }

            Button { model.showReport = true } label: { Label("Report a problem", systemImage: "exclamationmark.bubble") }
                .foregroundStyle(Color.raceMuted)
        }
        .sheet(isPresented: Binding(get: { model.showReport }, set: { model.showReport = $0 })) { ReportView() }
        .task {
            while !Task.isCancelled {
                model.socket.presencePing()
                try? await Task.sleep(for: .seconds(90))
            }
        }
    }

    private func canAnswer(_ question: QuestionEvent) -> Bool { question.state == .live }
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
        Button(action: action) { Text(title).frame(maxWidth: .infinity).frame(minHeight: 54).font(.title3.bold()) }
            .foregroundStyle(.white)
            .background(color.opacity(disabled ? 0.35 : 1), in: RoundedRectangle(cornerRadius: 12))
            .disabled(disabled)
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
        HStack {
            Label("Lap \(snapshot?.lapNumber ?? 0)/\(snapshot?.totalLaps ?? 0)", systemImage: "flag.checkered")
            Spacer()
            Text(snapshot?.trackStatus?.rawValue ?? "WAITING")
                .font(.caption.bold())
                .foregroundStyle(snapshot?.trackStatus == .green ? Color.raceGreen : Color.raceMuted)
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(Color.raceMuted)
        .padding(12)
        .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 10))
        if let leader = snapshot?.leader, !leader.isEmpty {
            HStack {
                Label("P1", systemImage: "flag.fill").foregroundStyle(Color.raceRed)
                Text(leader).fontWeight(.bold)
                Spacer()
                if let topThree = snapshot?.topThree { Text(topThree.joined(separator: " · ")).font(.caption).foregroundStyle(Color.raceMuted).lineLimit(1) }
            }
            .padding(12)
            .background(Color.racePanel, in: RoundedRectangle(cornerRadius: 10))
        }
    }
}
