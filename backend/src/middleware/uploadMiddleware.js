import multer from 'multer';
import path from 'path';

//storage settings 

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); //folder to save
    }, 
    filename: (req, file, cb) => {
        //unique filename: timestamp + original extension
         cb(null, Date.now() + path.extname(file.originalname));
    }, 
});

//only allow image files 

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.test(ext)) {     
    cb(null, true);
  } else {
    cb(new Error("Only .jpeg, .jpg, .png allowed"));
  }
};

export const upload = multer ({ storage, fileFilter });
