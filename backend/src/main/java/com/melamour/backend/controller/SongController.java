package com.melamour.backend.controller;

import com.melamour.backend.entity.Song;
import com.melamour.backend.service.SongService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/songs")
public class SongController {
    private final SongService service;
    public SongController(SongService service) { this.service = service; }

    @GetMapping
    public List<Song> list() { return service.list(); }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file,
                                    @RequestParam(value = "title", required = false) String title,
                                    @RequestParam(value = "artist", required = false) String artist) throws IOException {
        return ResponseEntity.ok(service.upload(file, title, artist));
    }

    @GetMapping("/{id}/stream")
    public ResponseEntity<Resource> stream(@PathVariable Long id) throws IOException {
        Song song = service.get(id);
        Resource resource = service.resource(id);
        MediaType type;
        try { type = MediaType.parseMediaType(song.getContentType()); }
        catch (Exception e) { type = MediaType.APPLICATION_OCTET_STREAM; }
        return ResponseEntity.ok().contentType(type).header(HttpHeaders.ACCEPT_RANGES, "bytes").body(resource);
    }
}
