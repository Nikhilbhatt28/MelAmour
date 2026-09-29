package com.melamour.backend.controller;

import com.melamour.backend.entity.Song;
import com.melamour.backend.service.SongService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaTypeFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/songs")
public class SongController {

    private final SongService service;

    public SongController(SongService service) {
        this.service = service;
    }

    @GetMapping
    public List<Song> list() {
        return service.list();
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "artist", required = false) String artist) throws IOException {

        return ResponseEntity.ok(
                service.upload(file, title, artist));
    }

    @GetMapping("/{id}/stream")
    public ResponseEntity<Resource> stream(
            @PathVariable Long id) throws IOException {

        Song song = service.get(id);
        Resource resource = service.resource(id);

        MediaType mediaType = MediaTypeFactory
                .getMediaType(song.getFileName())
                .orElse(MediaType.APPLICATION_OCTET_STREAM);

        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(resource.contentLength())
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .body(resource);
    }
}