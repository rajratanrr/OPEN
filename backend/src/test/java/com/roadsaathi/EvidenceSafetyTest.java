package com.roadsaathi;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.roadsaathi.common.ApiException;
import com.roadsaathi.common.Db;
import com.roadsaathi.storage.EvidenceService;
import com.roadsaathi.user.User;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

class EvidenceSafetyTest {
  @TempDir Path directory;
  private final Db db = mock(Db.class);

  private EvidenceService storage() throws Exception {
    return new EvidenceService(
        db, directory.toString(), "local", "http://localhost:9000", "test", "", "");
  }

  private byte[] png(int width, int height) throws Exception {
    var bytes = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB), "png", bytes);
    return bytes.toByteArray();
  }

  @Test
  void normalizesActualImageBytesAndLimitsResolution() throws Exception {
    byte[] normalized = storage().normalize(png(2400, 1200));
    var image = ImageIO.read(new ByteArrayInputStream(normalized));
    assertEquals(1920, image.getWidth());
    assertEquals(960, image.getHeight());
    assertEquals((byte) 0xff, normalized[0]);
    assertEquals((byte) 0xd8, normalized[1]);
  }

  @Test
  void forgedJpegMimeTypeDoesNotPermitExecutableContent() throws Exception {
    var user = new User();
    user.id = UUID.randomUUID();
    var file =
        new MockMultipartFile(
            "image", "fake.jpg", "image/jpeg", "<script>alert(1)</script>".getBytes());
    assertThrows(ApiException.class, () -> storage().upload(file, user));
    verifyNoInteractions(db);
  }

  @Test
  void tinyImagesAndExcessivePixelCountsAreRejected() throws Exception {
    var store = storage();
    assertThrows(ApiException.class, () -> store.normalize(png(8, 8)));
    assertThrows(ApiException.class, () -> store.normalize(png(5000, 4001)));
  }

  @Test
  void storageKeysCannotTraverseDirectories() throws Exception {
    var store = storage();
    assertThrows(ApiException.class, () -> store.bytes("../../private.jpg"));
  }

  @Test
  void failedDatabaseWriteRemovesOrphanedImage() throws Exception {
    when(db.update(anyString(), anyMap()))
        .thenThrow(new IllegalStateException("Database unavailable"));
    var user = new User();
    user.id = UUID.randomUUID();
    var file = new MockMultipartFile("image", "road.png", "image/png", png(32, 32));
    assertThrows(IllegalStateException.class, () -> storage().upload(file, user));
    try (var files = Files.list(directory)) {
      assertEquals(0, files.count());
    }
  }

  @Test
  void evidenceOwnershipIsRequiredBeforeAnalysisOrSubmission() throws Exception {
    var store = storage();
    assertThrows(ApiException.class, () -> store.assertOwned(UUID.randomUUID(), UUID.randomUUID()));
  }
}
