import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('processed_image')
export class ProcessedImage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    b2Id: string;

    @Column()
    objKey: string;

    @Column()
    url: string;

    @Column()
    size: number;

    @Column()
    mimetype: string;

    @Column()
    status: string;

    @CreateDateColumn()
    createdAt: Date;
}
