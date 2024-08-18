import dotenv from "dotenv"
dotenv.config()

export const {
    AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY,
    AWS_SQS_URL,
    BUCKET_KEY,
    BUCKET_NAME,
    TASK_ARN,
    CLUSTER_ARN,
} = process.env