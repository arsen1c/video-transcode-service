import { DeleteMessageCommand, QueueAttributeName, ReceiveMessageCommand, SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, AWS_SQS_URL, TASK_ARN, CLUSTER_ARN } from "./config/config"
import { S3Event } from "aws-lambda"
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs"

const client = new SQSClient({
    region: "us-east-2",
    credentials: {
        accessKeyId: AWS_ACCESS_KEY as string,
        secretAccessKey: AWS_SECRET_ACCESS_KEY as string
    }
})

const ecsClient = new ECSClient({
    region: "us-east-2",
    credentials: {
        accessKeyId: AWS_ACCESS_KEY as string,
        secretAccessKey: AWS_SECRET_ACCESS_KEY as string
    }
})
/**
 * Fetch messages from the Queue
 * 
 * Steps:
 * 
 * - Validate & parse the event
 * - Spin up the docker container
 * - Delete the message from the Queue
 * 
 */
async function init() {
    // Command to receive messages from SQS Queue
    const command = new ReceiveMessageCommand({
        QueueUrl: AWS_SQS_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20 // long polling
    })

    while (true) {
        const { Messages } = await client.send(command)

        if (!Messages) {
            console.log(`No Message in Queue`)
            continue
        }

        try {
            for (const message of Messages) {
                const { MessageId, Body } = message
                console.log(`Message Received`, { MessageId, Body })

                // Validate and parse the event
                if (!Body) continue
                const event = JSON.parse(Body) as S3Event

                // ignore the test event
                if ("Service" in event && "Event" in event) {
                    if (event.Event === "s3:TestEvent") {
                        await client.send(new DeleteMessageCommand({ QueueUrl: AWS_SQS_URL, ReceiptHandle: message.ReceiptHandle }))
                        continue
                    }
                }

                // spin the docker container
                for (const record of event.Records) {
                    const { s3 } = record
                    const {
                        bucket,
                        object: { key } // this key will be used by the docker container to pull the file
                    } = s3

                    // For every record, we spin a new docker container
                    const runTaskCommand = new RunTaskCommand({
                        taskDefinition: TASK_ARN,// task ARN,
                        cluster: CLUSTER_ARN, // cluster arn
                        launchType: "FARGATE",
                        networkConfiguration: {
                            awsvpcConfiguration: {
                                securityGroups: ["sg-0bd3782feda645b5b"], // default one
                                assignPublicIp: "ENABLED",
                                subnets: ["subnet-01b6a166329245692", "subnet-076ee1b762ca3d200", "subnet-0a0dacc74bf8439ee"]
                            }
                        },
                        overrides: {
                            containerOverrides: [{
                                name: "video-transcoder",
                                environment: [{ name: "BUCKET_NAME", value: bucket.name },
                                { name: "KEY", value: key }
                                ]
                            }], // task definition -> video-transcoder -> container name
                        }
                    })

                    await ecsClient.send(runTaskCommand)

                    // Delete the message from the queue
                    await client.send(new DeleteMessageCommand({ QueueUrl: AWS_SQS_URL, ReceiptHandle: message.ReceiptHandle }))
                }
            }
        } catch (error) {
            console.error(error)
        }
    }
}

init()