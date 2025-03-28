#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs/promises';
import { homedir } from 'os';
import path from 'path';

const server = new McpServer({
    name: "ImageReader",
    version: "1.0.0"
});

// 이미지 전송 Tool 정의
server.tool(
    "read_image", // Tool 이름
    "Reads an image file from the specified path and returns it as Base64-encoded JPEG data", // Tool 설명
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
            const imageBuffer = await fs.readFile(absolutePath);

            // Base64로 인코딩
            const base64Image = imageBuffer.toString('base64');

            // 파일 확장자 추출 및 MIME 타입 결정 (대소문자 구분 없음)
            const extension = path.extname(absolutePath).toLowerCase();
            let mimeType = "image/jpeg"; // 기본값

            if (extension === '.png') {
                mimeType = "image/png";
            } else if (extension === '.jpg' || extension === '.jpeg') {
                mimeType = "image/jpeg";
            }

            // 결과 반환 (파일 확장자에 따른 MIME 타입 적용)
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
                    text: `Error sending image: ${error.message}`
                }],
                isError: true
            };
        }
    }
);

// 서버에 연결
const transport = new StdioServerTransport();
server.connect(transport);