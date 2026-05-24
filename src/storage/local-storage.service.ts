import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class LocalStorageService {
  constructor(private readonly configService: ConfigService) {}

  async saveDocumentFile(
    companyId: string,
    docType: string,
    fileName: string,
    content: string,
  ): Promise<string> {
    const dir = join(
      this.configService.get<string>('sunat.storagePath', './storage'),
      companyId,
      docType,
    );
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, fileName);
    await writeFile(filePath, content, 'utf8');
    return filePath;
  }
}
