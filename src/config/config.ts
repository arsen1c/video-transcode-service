import dotenv from "dotenv"
dotenv.config()

export const {
    AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY,
    AWS_SQS_URL
} = process.env