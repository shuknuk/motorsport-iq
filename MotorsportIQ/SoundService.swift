import AVFoundation

enum RaceSound: String, Sendable {
    case questionAlert = "question-alert"
    case correct
    case wrong
}

@MainActor
final class SoundService {
    private var players: [RaceSound: AVAudioPlayer] = [:]

    init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        for sound in [RaceSound.questionAlert, .correct, .wrong] {
            guard let url = Bundle.main.url(forResource: sound.rawValue, withExtension: "mp3"), let player = try? AVAudioPlayer(contentsOf: url) else { continue }
            player.prepareToPlay(); players[sound] = player
        }
    }

    func play(_ sound: RaceSound) {
        guard UserDefaults.standard.object(forKey: "msp_sounds_enabled") as? Bool ?? true else { return }
        players[sound]?.currentTime = 0; players[sound]?.play()
    }
}
