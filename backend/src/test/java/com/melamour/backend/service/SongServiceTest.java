package com.melamour.backend.service;

import com.melamour.backend.entity.Song;
import com.melamour.backend.repository.SongRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SongServiceTest {

    @Mock
    private SongRepository repository;

    @TempDir
    Path tempDir;

    @Test
    void uploadStoresAudioAndMetadata() throws Exception {
        SongService service = new SongService(repository, tempDir.toString());

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test-song.mp3",
                "audio/mpeg",
                "fake-audio-data".getBytes()
        );

        when(repository.save(any(Song.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Song song = service.upload(file, "Test Song", "Test Artist");

        assertEquals("Test Song", song.getTitle());
        assertEquals("Test Artist", song.getArtist());
        assertEquals("test-song.mp3", song.getFileName());
        assertTrue(Files.exists(tempDir.resolve(song.getStoredFileName())));
        verify(repository).save(any(Song.class));
    }

    @Test
    void listRemovesSongsWhoseFilesAreMissing() throws Exception {
        Song valid = new Song();
        valid.setTitle("Valid Song");
        valid.setStoredFileName("valid.mp3");
        valid.setFileName("valid.mp3");

        Song missing = new Song();
        missing.setTitle("Missing Song");
        missing.setStoredFileName("missing.mp3");
        missing.setFileName("missing.mp3");

        Files.write(tempDir.resolve("valid.mp3"), "audio".getBytes());
        when(repository.findAll()).thenReturn(List.of(valid, missing));

        SongService service = new SongService(repository, tempDir.toString());
        List<Song> result = service.list();

        assertEquals(1, result.size());
        assertEquals("Valid Song", result.get(0).getTitle());
        verify(repository).delete(missing);
        verify(repository, never()).delete(valid);
    }
}
