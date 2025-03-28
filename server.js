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
    version: "1.0.8"
});

const MAX_SIZE = 1048576; // 1MB
const MAX_DIMENSION = 1280; // 최대 폭/높이

server.tool(
    "read_image", // Tool 이름
    "Reads an image file from the specified path and returns it as Base64-encoded JPEG or PNG data", // Tool 설명
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

            // 파일 확장자 추출 및 MIME 타입 결정
            const extension = path.extname(absolutePath).toLowerCase();
            let mimeType = "image/jpeg"; // 기본값
            if (extension === '.png') mimeType = "image/png";
            else if (extension === '.jpg' || extension === '.jpeg') mimeType = "image/jpeg";

            // Sharp로 메타데이터 확인
            let sharpImage = sharp(imageBuffer);
            let metadata = await sharpImage.metadata();
            let processedBuffer = imageBuffer;

            // 크기 조정 필요 여부 확인
            if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || imageBuffer.length > MAX_SIZE) {
                // 먼저 1280px 제한에 맞게 리사이즈
                sharpImage = sharp(imageBuffer).resize({
                    width: MAX_DIMENSION,
                    height: MAX_DIMENSION,
                    fit: 'inside', // 비율 유지
                    withoutEnlargement: true // 확대 방지
                });

                processedBuffer = await sharpImage.toBuffer();

                // 여전히 1MB를 초과하는 경우
                if (processedBuffer.length > MAX_SIZE) {
                    if (mimeType === 'image/jpeg') {
                        // JPG: 품질 조절
                        let quality = 80;
                        do {
                            processedBuffer = await sharpImage
                                .jpeg({ quality })
                                .toBuffer();
                            quality -= 10;
                            if (quality <= 10) break;
                        } while (processedBuffer.length > MAX_SIZE);
                    } else if (mimeType === 'image/png') {
                        // PNG: 10%씩 해상도 축소
                        let scaleFactor = 0.9;
                        let currentWidth = Math.min(metadata.width, MAX_DIMENSION);
                        let currentHeight = Math.min(metadata.height, MAX_DIMENSION);

                        do {
                            currentWidth = Math.round(currentWidth * scaleFactor);
                            currentHeight = Math.round(currentHeight * scaleFactor);

                            processedBuffer = await sharp(imageBuffer)
                                .resize({
                                    width: currentWidth,
                                    height: currentHeight,
                                    fit: 'inside'
                                })
                                .png()
                                .toBuffer();

                            scaleFactor *= 0.9;
                            if (currentWidth <= 100 || currentHeight <= 100) break; // 최소 크기 제한
                        } while (processedBuffer.length > MAX_SIZE);
                    }
                }
            }

            // Base64로 인코딩
            const base64Image = processedBuffer.toString('base64');

            // 결과 반환
            return {
                content: [{
                    type: "image",
                    data: base64Image,
                    mimeType: mimeType
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