import AVFoundation
import AVFAudio

enum RaceSound: String, Sendable {
    case questionAlert = "question-alert"
    case correct
    case wrong
}

@MainActor
final class SoundService {
    private let audioSession = AVAudioSession.sharedInstance()
    private var players: [RaceSound: AVAudioPlayer] = [:]

    init() {
        for sound in [RaceSound.questionAlert, .correct, .wrong] {
            guard let url = Bundle.main.url(forResource: sound.rawValue, withExtension: "mp3"), let player = try? AVAudioPlayer(contentsOf: url) else { continue }
            player.prepareToPlay(); players[sound] = player
        }
    }

    func play(_ sound: RaceSound) {
        guard UserDefaults.standard.object(forKey: "msp_sounds_enabled") as? Bool ?? true else { return }
        guard let player = players[sound] else { return }
        if #available(iOS 27.0, *) {
            audioSession.activate(options: []) { [weak player] activated, _ in
                guard activated else { return }
                Task { @MainActor [weak player] in
                    player?.currentTime = 0
                    player?.play()
                }
            }
        } else {
            player.currentTime = 0
            player.play()
        }
    }
}
