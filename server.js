#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs/promises';
import { homedir } from 'os';
import path from 'path';
import sharp from 'sharp'; // Sharp 모듈 추가

const server = new McpServer({
    name: "ImageReader",
    version: "1.0.0"
});

// 최대 파일 크기 상수 (1MB = 1048576 bytes)
const MAX_SIZE = 1048576;

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

            if (extension === '.png') {
                mimeType = "image/png";
            } else if (extension === '.jpg' || extension === '.jpeg') {
                mimeType = "image/jpeg";
            }

            // Sharp를 사용한 이미지 처리
            let sharpImage = sharp(imageBuffer);
            let metadata = await sharpImage.metadata();
            let resizedBuffer = imageBuffer;

            // 파일 크기가 1MB를 초과하는 경우 리사이징
            if (imageBuffer.length > MAX_SIZE) {
                let quality = 80; // 초기 품질 설정
                let scaleFactor = 0.9; // 크기 조절 비율

                do {
                    // 이미지 리사이징 및 품질 조정
                    sharpImage = sharp(imageBuffer)
                        .resize({
                            width: Math.round(metadata.width * scaleFactor),
                            height: Math.round(metadata.height * scaleFactor),
                        });

                    // MIME 타입에 따라 적절한 압축 적용
                    if (mimeType === 'image/jpeg') {
                        resizedBuffer = await sharpImage
                            .jpeg({ quality })
                            .toBuffer();
                    } else if (mimeType === 'image/png') {
                        resizedBuffer = await sharpImage
                            .png({ quality: Math.round(quality * 0.9) }) // PNG는 0-9 스케일
                            .toBuffer();
                    }

                    // 다음 반복을 위한 조정
                    if (resizedBuffer.length > MAX_SIZE) {
                        quality -= 10; // 품질 감소
                        scaleFactor *= 0.9; // 크기 추가 축소
                    }

                    if (quality <= 10) break; // 최소 품질 도달 시 중단

                } while (resizedBuffer.length > MAX_SIZE);
            }

            // Base64로 인코딩
            const base64Image = resizedBuffer.toString('base64');

            // 결과 반환
            return {
                content: [{
                    type: "image",
                    data: base64Image,
                    mimeType: mimeType
                }]
            };
        } catch (error) {
            // 에러 처리
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