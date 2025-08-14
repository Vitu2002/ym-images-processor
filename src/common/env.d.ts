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
        API_SECRET: string; // api secret to auth delete request
    }
}
