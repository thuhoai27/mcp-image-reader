#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs/promises';
import { homedir } from 'os';
import path from 'path';
import sharp from 'sharp';

const server = new McpServer({
    name: "ImageReader",
    version: "1.0.9"
});

const MAX_SIZE = 1048576; // 1MB
const MAX_DIMENSION = 1280; // 최대 폭/높이

server.tool(
    "read_image",
    "Reads an image file from the specified path and returns it as Base64-encoded JPEG data",
    {
        imagePath: z.string().describe("The absolute or relative path to the image file (e.g., '/path/to/image.jpg')")
    },
    async ({ imagePath }) => {
        try {
            // 이미지 파일 경로를 절대 경로로 변환
            const absolutePath = path.isAbsolute(imagePath)
                ? imagePath
                : path.resolve(homedir(), imagePath);

            // 이미지 파일 읽기
            let imageBuffer = await fs.readFile(absolutePath);

            // Sharp 인스턴스 생성
            let sharpImage = sharp(imageBuffer);
            let metadata = await sharpImage.metadata();

            // PNG라면 JPEG로 변환
            const extension = path.extname(absolutePath).toLowerCase();
            if (extension === '.png') {
                sharpImage = sharpImage.jpeg(); // PNG를 JPEG로 변환
            }

            // 해상도 체크 및 리사이즈
            if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
                sharpImage = sharpImage.resize({
                    width: MAX_DIMENSION,
                    height: MAX_DIMENSION,
                    fit: 'inside', // 비율 유지
                    withoutEnlargement: true // 확대 방지
                });
            }

            // JPEG로 처리된 버퍼 생성
            let processedBuffer = await sharpImage.jpeg().toBuffer();

            // 파일 크기 체크 및 품질 조정
            if (processedBuffer.length > MAX_SIZE) {
                let quality = 80;
                do {
                    processedBuffer = await sharpImage
                        .jpeg({ quality })
                        .toBuffer();
                    quality -= 10;
                    if (quality <= 10) break; // 품질 최소값 제한
                } while (processedBuffer.length > MAX_SIZE);
            }

            // Base64로 인코딩
            const base64Image = processedBuffer.toString('base64');

            // 결과 반환
            return {
                content: [{
                    type: "image",
                    data: base64Image,
                    mimeType: "image/jpeg" // 항상 JPEG로 반환
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: `Error processing image: ${error.message}`
                }],
                isError: true
            };
        }
    }
);

// 서버에 연결
const transport = new StdioServerTransport();
server.connect(transport);