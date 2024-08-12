import { QueueAttributeName, ReceiveMessageCommand, SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs"
import { AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, AWS_SQS_URL } from "./config/config"

const client = new SQSClient({
    region: "us-east-2",
    credentials: {
        accessKeyId: AWS_ACCESS_KEY as string,
        secretAccessKey: AWS_SECRET_ACCESS_KEY as string
    }
})

async function init() {
    const command = new ReceiveMessageCommand({
        QueueUrl: AWS_SQS_URL,
        MaxNumberOfMessages: 1
    })

    while (true) {
        const { Messages } = await client.send(command)

        if (!Messages) {
            console.log(`No Message in Queue`)
            continue
        }

        for (const message of Messages) {
            const { MessageId, Body } = message
            console.log(`Message Received`, { MessageId, Body })
        }
    }
}

init()