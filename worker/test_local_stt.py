import io
import json
import struct
import unittest

import numpy as np

from local_stt import read_request, serve


def packet(language, samples):
    payload = bytes([language]) + np.asarray(samples, dtype="<i2").tobytes()
    return struct.pack("<I", len(payload)) + payload


class LocalSttTests(unittest.TestCase):
    def test_both_audio_streams_keep_original_pcm(self):
        for code, language in [(0, "en"), (1, "th")]:
            actual_language, samples = read_request(io.BytesIO(packet(code, [100, -200])))
            self.assertEqual(actual_language, language)
            np.testing.assert_array_equal(samples, [100, -200])

    def test_rejects_bad_lengths_languages_and_truncated_audio(self):
        for raw in [struct.pack("<I", 1_000_000), packet(2, [1]), b"\x03", struct.pack("<I", 4) + b"\x00\x01\x00", struct.pack("<I", 5) + b"\x00"]:
            with self.subTest(raw=raw[:4]), self.assertRaises(ValueError):
                read_request(io.BytesIO(raw))

    def test_silence_never_reaches_recognizer_and_worker_handles_next_phrase(self):
        class Recognizer:
            def transcribe(self, samples, language):
                self.language = language
                return "ไปทางซ้าย"

        recognizer = Recognizer()
        source = io.BytesIO(packet(0, np.zeros(4000)) + packet(1, [2000] * 4000))
        output = io.StringIO()
        serve(recognizer, source, output)
        events = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(events, [{"ready": True}, {"text": ""}, {"text": "ไปทางซ้าย"}])
        self.assertEqual(recognizer.language, "th")

    def test_inference_failure_is_explicit_not_a_successful_empty_transcript(self):
        class Broken:
            def transcribe(self, samples, language):
                raise RuntimeError("model failed")

        output = io.StringIO()
        serve(Broken(), io.BytesIO(packet(0, [2000] * 4000)), output)
        self.assertEqual(json.loads(output.getvalue().splitlines()[1]), {"error": "Local speech recognition failed"})


if __name__ == "__main__":
    unittest.main()
