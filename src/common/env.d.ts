declare namespace NodeJS {
    interface ProcessEnv {
        NODE_ENV: 'development' | 'production' | 'test';
        MINIO_ENDPOINT: string; // s3.min.io
        MINIO_ACCESS_KEY: string; // access key
        MINIO_SECRET_KEY: string; // secret key
        MINIO_BUCKET: string; // bucket name
        B2_BUCKET: string; // bucket name
        B2_KEY: string; // access key
        B2_SECRET: string; // secret key
        REDIS_URI: string; // redis://localhost:6379
        DATABASE_URL: string; // postgres://user:password@localhost:5432
        CHUNK_SIZE: number; // max number of objects to fetch at once
        API_SECRET: string; // api secret to auth delete request
        CONCURRENCY: number; // number of concurrent image processing jobs
        WORKER_ONLY: boolean | string; // if true, only worker will run
    }
}
