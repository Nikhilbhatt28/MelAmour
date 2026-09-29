package com.melamour.backend.service;

import com.melamour.backend.entity.Song;
import com.melamour.backend.repository.SongRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;

@Service
public class SongService {

    private final SongRepository repository;
    private final Path uploadDir;

    public SongService(
            SongRepository repository,
            @Value("${melamour.upload-dir:uploads}") String uploadDir) throws IOException {

        this.repository = repository;

        this.uploadDir = Paths
                .get(uploadDir)
                .toAbsolutePath()
                .normalize();

        Files.createDirectories(this.uploadDir);
    }

    public List<Song> list() {

        return repository.findAll().stream()
                .filter(song -> {

                    Path path = uploadDir
                            .resolve(song.getStoredFileName())
                            .normalize();

                    if (Files.exists(path)) {
                        return true;
                    }

                    // Remove database record if the actual file is missing
                    repository.delete(song);

                    return false;
                })
                .toList();
    }

    public Song upload(
            MultipartFile file,
            String title,
            String artist) throws IOException {

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Audio file is required");
        }

        String type = file.getContentType() == null
                ? ""
                : file.getContentType();

        String original = file.getOriginalFilename() == null
                ? "song"
                : file.getOriginalFilename();

        String lower = original.toLowerCase();

        if (!type.startsWith("audio/")
                && !lower.endsWith(".mp3")
                && !lower.endsWith(".wav")
                && !lower.endsWith(".ogg")
                && !lower.endsWith(".m4a")) {

            throw new IllegalArgumentException(
                    "Please upload an audio file (MP3, WAV, OGG or M4A)");
        }

        String ext = lower.contains(".")
                ? lower.substring(lower.lastIndexOf('.'))
                : ".mp3";

        String stored = UUID.randomUUID() + ext;

        Path target = uploadDir.resolve(stored);

        Files.copy(
                file.getInputStream(),
                target,
                StandardCopyOption.REPLACE_EXISTING);

        Song song = new Song();

        song.setTitle(
                title == null || title.isBlank()
                        ? original.replaceFirst("\\.[^.]+$", "")
                        : title.trim());

        song.setArtist(
                artist == null
                        ? ""
                        : artist.trim());

        song.setFileName(original);
        song.setStoredFileName(stored);

        song.setContentType(
                type.isBlank()
                        ? "audio/mpeg"
                        : type);

        song.setFileSize(file.getSize());

        return repository.save(song);
    }

    public Song get(Long id) {

        return repository.findById(id)
                .orElseThrow(
                        () -> new IllegalArgumentException("Song not found"));
    }

    public Resource resource(Long id) throws IOException {

        Song song = get(id);

        Path path = uploadDir
                .resolve(song.getStoredFileName())
                .normalize();

        if (!Files.exists(path)) {

            // Clean up stale database record
            repository.delete(song);

            throw new IllegalArgumentException(
                    "Song file is missing");
        }

        return new UrlResource(path.toUri());
    }
}