import { updateUserProfile } from "../services/profileService.js";
import { handleResponse } from "../utils/handleResponse.js";
import { logService } from "../services/logService.js";

// handle the update profile request
export const updateProfile = async (req, res) => {
  try {
    // pass req.body and file to service
    const updatedUser = await updateUserProfile(
      req.user.id,
      req.body,
      req.file
    );

    // log profile update
    await logService.add({
      userId: req.user?.id || null,
      roleId: req.user?.roleID || null,
      action: "UPDATE_PROFILE",
      targetTable: "users",
      targetId: req.user?.id || null,
      details: {
        updatedFields: Object.keys(req.body), // only log which fields were attempted to update
        fileUploaded: !!req.file,
      },
    });

    // return success response
    return handleResponse(res, 200, "profile updated successfully", updatedUser);
  } catch (err) {
  
    console.error("profile update error:", err);

    return handleResponse(res, 500, "internal server error");
  }
};
