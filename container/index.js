/**
 * Code for the servers (docker containers) that will actually fetch videos and process them. 

 * Steps:

 * 1. Download the original video
 * 2. Start the transcoder
 * 3. Upload the video
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3")
// const { AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, BUCKET_NAME, BUCKET_KEY } = require("../src/config/config")
const fs = require("node:fs/promises")
const fsOld = require("fs")
// const fs = require("fs")
const path = require("node:path")

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require("fluent-ffmpeg")
ffmpeg.setFfmpegPath(ffmpegInstaller.path);


const RESOLUTIONS = [
    { name: "480p", width: 858, height: 480 },
    { name: "720p", width: 1270, height: 720 },
    { name: "1080p", width: 1920, height: 1080 }
]


console.log(process.env.AWS_ACCESS_KEY)

// S3 client instance
const s3Client = new S3Client({
    region: "us-east-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
})
async function init() {
    console.log("running docker container...")
    // Download the original video
    const command = new GetObjectCommand({
        Bucket: "tut.video-transcode.arsen1c",
        Key: process.env.BUCKET_KEY
    })

    const result = await s3Client.send(command)

    const originalFilePath = `videos/original-video.mp4`
    await fs.mkdir(path.resolve(__dirname, "videos"))

    console.log(`got original video: ${result.Body}`)

    await fs.writeFile(originalFilePath, result.Body)

    // Resolve the path to avoid errors
    const originalVideoPath = path.resolve(originalFilePath)
    console.log(`originalVideoPath after resolve: ${originalVideoPath}`)


    // Start the transcoder
    const promises = RESOLUTIONS.map(async (resolution) => {
        const output = `transcoded/video-${resolution.name}.mp4`
        console.log(path.resolve(__dirname, "transcoded"))
        await fs.mkdir(path.resolve(__dirname, "transcoded"), { recursive: true })
        return new Promise((resolve) => {
            console.log(`starting the file conversion`)
            ffmpeg(originalVideoPath)
                .outputOptions('-max_muxing_queue_size', '1024') // to prevent too many buffers issue
                .output(output)
                .withVideoCodec("libx264")
                .audioCodec("aac")
                .withSize(`${resolution.width}x${resolution.height}`)
                .on("end", async () => {
                    console.log("uploading on production bucket")
                    // Upload the video to the production bucket upon finishing the transcoding 
                    const putCommand = new PutObjectCommand({
                        // TODO: Put this into a new env variable
                        Bucket: "tut.production-video-transcode.arsen1c",
                        Key: output, // the file name should have a unique ID in it
                        Body: fsOld.createReadStream(path.resolve(output))
                    })

                    await s3Client.send(putCommand)
                    console.log(`uploaded on the prod bucket: ${output}`)
                    resolve()
                })
                .on('error', function (err, stdout, stderr) {
                    if (err) {
                        console.log(err.message);
                        console.log("stdout:\n" + stdout);
                        console.log("stderr:\n" + stderr);
                    }
                })
                .format("mp4")
                .run()
        })
    })

    console.log(`transcoder promises: ${promises}`)

    await Promise.all(promises)
}

init()