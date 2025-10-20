import userService from "./userService.js";
import fs from "fs";
import path from "path";

//this updates user profile, including personal info, password and profile image

export const updateUserProfile = async (userId, data, file) => {
    const { firstName, lastName , birthday, gender, email, contactNumber, bio, password } = data;

    //get current user first 

    const user = await userService.fetchUserbyIdService(userId);

    if (!user) {
        throw new Error('User not found');
    }

    let profileImg = user.profileimg; // keep existing image if no new file
    const nextBio = bio !== undefined ? (bio ?? "").toString().trim() : user.bio;
    if (file) {
        //delete old image if exists
        if (profileImg && fs.existsSync(path.join('uploads', profileImg))) {
            fs.unlinkSync(path.join('uploads', profileImg));
        }
        profileImg = file.filename; // set new pic
    }

    // call userService to update everything in db

    const updatedUser = await userService.updateUserService(
        userId,
        firstName ?? user.firstname,
        lastName ?? user.lastname,
        birthday ?? user.birthday,
        gender ?? user.gender,
        email ?? user.email,
        contactNumber ?? user.contactnumber,
        nextBio,
        password ?? null, // only update if provided
        profileImg,
        null
    );

    return updatedUser;
};

