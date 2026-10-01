// Persistent, CPU-only speech worker. PCM stays in memory; stdout is JSONL only.
#include "whisper.h"
#include "json.hpp"
#include <cmath>
#include <cstdint>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#include <process.h>
#else
#include <unistd.h>
#endif

static void emit(const nlohmann::json &event) {
    std::cout << event.dump(-1, ' ', true) << std::endl;
}

static void read_exact(char *destination, size_t count) {
    if (!std::cin.read(destination, static_cast<std::streamsize>(count))) {
        throw std::runtime_error("Truncated local STT frame");
    }
}

int main(int argc, char **argv) {
#ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
#endif
    try {
        std::string model;
        int threads = 2;
        for (int i = 1; i < argc; ++i) {
            std::string option = argv[i];
            if (i + 1 >= argc) throw std::runtime_error("Missing argument value");
            if (option == "--model-dir") model = argv[++i]; // Same controller protocol; value is a GGML file.
            else if (option == "--threads") threads = std::stoi(argv[++i]);
            else throw std::runtime_error("Unknown worker argument");
        }
        if (model.empty() || threads < 1 || threads > 4) throw std::runtime_error("Invalid worker configuration");
        whisper_log_set([](ggml_log_level, const char *, void *) {}, nullptr);
        auto context_params = whisper_context_default_params();
        context_params.use_gpu = false;
        std::unique_ptr<whisper_context, decltype(&whisper_free)> context(
            whisper_init_from_file_with_params(model.c_str(), context_params), whisper_free);
        if (!context) throw std::runtime_error("Cannot load Whisper model. Run setup-whisper.ps1.");
        emit({{"ready", true}, {"pid", getpid()}});
        while (true) {
            unsigned char header[4];
            if (!std::cin.read(reinterpret_cast<char *>(header), 1)) break;
            read_exact(reinterpret_cast<char *>(header + 1), 3);
            uint32_t size = uint32_t(header[0]) | (uint32_t(header[1]) << 8) |
                            (uint32_t(header[2]) << 16) | (uint32_t(header[3]) << 24);
            if (size < 3 || size > 960001 || size % 2 != 1) throw std::runtime_error("Invalid local STT frame length");
            std::vector<unsigned char> payload(size);
            read_exact(reinterpret_cast<char *>(payload.data()), size);
            if (payload[0] > 1) throw std::runtime_error("Invalid local STT language");
            std::vector<float> samples((size - 1) / 2);
            double square_sum = 0;
            for (size_t i = 0; i < samples.size(); ++i) {
                int value = int(payload[1 + i * 2]) | (int(payload[2 + i * 2]) << 8);
                if (value >= 32768) value -= 65536;
                samples[i] = value / 32768.0f;
                square_sum += samples[i] * samples[i];
            }
            if (samples.size() < 3200 || std::sqrt(square_sum / samples.size()) < 0.001) {
                emit({{"text", ""}});
                continue;
            }
            auto params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
            params.n_threads = threads;
            params.language = payload[0] == 0 ? "en" : "th";
            params.translate = false;
            params.no_context = true; // No text leakage between incoming and microphone streams.
            params.no_timestamps = true;
            params.single_segment = true;
            params.print_progress = params.print_realtime = params.print_timestamps = params.print_special = false;
            params.max_tokens = 128;
            params.temperature_inc = 0.0f; // Bound work: no repeated temperature fallback.
            params.greedy.best_of = 1;
            if (whisper_full(context.get(), params, samples.data(), static_cast<int>(samples.size())) != 0) {
                emit({{"error", "Local speech recognition failed"}});
                continue;
            }
            std::string text;
            for (int i = 0; i < whisper_full_n_segments(context.get()); ++i) {
                text += whisper_full_get_segment_text(context.get(), i);
            }
            auto first = text.find_first_not_of(" \r\n\t");
            text = first == std::string::npos ? "" : text.substr(first, text.find_last_not_of(" \r\n\t") - first + 1);
            emit({{"text", text}});
        }
        return 0;
    } catch (const std::exception &error) {
        emit({{"error", error.what()}});
        return 2;
    }
}
