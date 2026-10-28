import multer from "multer";
import { MAX_CHAT_IMAGE_BYTES, MAX_GALLERY_IMAGES, MAX_IMAGE_BYTES, MAX_RESUME_BYTES, } from "../config/constants.js";
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_IMAGE_BYTES,
        files: MAX_GALLERY_IMAGES,
        fields: 10,
    },
});
const resumeUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_RESUME_BYTES,
        files: 1,
        fields: 5,
    },
});
export const uploadSingleImage = imageUpload.single("file");
export const uploadGalleryImages = imageUpload.array("files", MAX_GALLERY_IMAGES);
export const uploadResume = resumeUpload.single("file");
const chatImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_CHAT_IMAGE_BYTES, files: 1, fields: 3 },
});
export const uploadChatImage = chatImageUpload.single("file");
//# sourceMappingURL=upload.js.map