import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import B2 from 'backblaze-b2';

@Injectable()
export class B2Service extends B2 implements OnModuleInit {
    private readonly logger = new Logger(B2Service.name);
    private readonly BUCKET_ID = process.env.B2_BUCKET || 'images';
    private readonly BUCKET_NAME = process.env.MINIO_BUCKET || 'images';
    private status = 'loading';

    constructor() {
        super({
            applicationKeyId: process.env.B2_KEY,
            applicationKey: process.env.B2_SECRET
        });
    }

    async onModuleInit() {
        await this.auth();

        try {
            // Check if bucket exists, if not, create it
            const exists = await this.listBuckets({
                axiosOverride: { data: { bucketId: this.BUCKET_ID } }
            });
            if (!exists) {
                this.logger.warn(`Bucket ${this.BUCKET_ID} not found, creating...`);
                await this.createBucket({ bucketName: this.BUCKET_NAME, bucketType: 'allPublic' });
                this.logger.warn(`Bucket ${this.BUCKET_ID} created (Public)`);
                this.status = 'connected';
            } else {
                this.logger.log(`Bucket ${this.BUCKET_ID} connected`);
                this.status = 'connected';
            }
        } catch (err: unknown) {
            if (err instanceof Error) this.logger.error(err.message);
            this.status = 'error';
            // Exit process because can't grant access to bucket
            process.exit(1);
        }
    }

    getStatus() {
        return this.status;
    }

    // Authenticate with B2 in loop to keep connection alive (23h55 timeout)
    async auth() {
        const auth = async () => {
            try {
                await this.authorize();
                return this.logger.log('Connected');
            } catch (err: unknown) {
                if (err instanceof Error) this.logger.error(err.message);
                process.exit(1); // Exit process because can't grant access to bucket
            }
        };

        // Run auth() every 23h55 to keep connection alive
        setInterval(auth, 23 * 60 * 60 * 1000);
        return await auth(); // Run auth() once to start
    }

    // Generate presigned URL for object, valid for 7 days (default)
    async generateUploadUrl() {
        const res = await this.getUploadUrl({ bucketId: this.BUCKET_ID });
        const data = res.data as Omit<GetUpResponse, 'uploadAuthToken'> & {
            authorizationToken: string;
        };
        return {
            bucketId: data.bucketId,
            uploadUrl: data.uploadUrl,
            uploadAuthToken: data.authorizationToken
        };
    }

    async upload(file: Buffer, objKey: string, auth: GetUpResponse) {
        this.logger.log(`Uploading ${objKey}`);
        const res = await this.uploadFile({
            ...auth,
            data: file,
            fileName: objKey,
            mime: 'image/avif',
            contentLength: file.byteLength
        });
        return res.data as UploadResponse;
    }
}

interface GetUpResponse {
    bucketId: string;
    uploadUrl: string;
    uploadAuthToken: string;
}

interface UploadResponse {
    action: 'start' | 'upload' | 'hide' | 'folder';
    fileId: string;
    fileName: string;
}
