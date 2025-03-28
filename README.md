# ImageReader

ImageReader is a Model Context Protocol (MCP) server that reads image files and converts them to Base64-encoded data for AI models. This tool allows AI models to analyze and process images from the local file system.

## Features

- **Image Reading**: Reads image files from the local file system
- **Base64 Encoding**: Converts images to Base64 format
- **Multiple Format Support**: Supports various image formats including JPG, PNG, etc.
- **Absolute and Relative Paths**: Supports both absolute and relative paths

## Installation
```json
{
    "mcpServers": {
        "image_reader": {
            "command": "npx",
            "args": [
                "-y",
                "mcp-image-reader"
            ]
        }
    }
}
```