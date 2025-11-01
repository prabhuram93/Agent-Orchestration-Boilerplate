FROM --platform=linux/arm64 docker.io/cloudflare/sandbox:0.4.14
RUN npm install -g @anthropic-ai/claude-code
ENV COMMAND_TIMEOUT_MS=300000
EXPOSE 3000