FROM golang:1.21.5
WORKDIR /app
COPY ./main /app/main
RUN chmod +x /app/main
EXPOSE 8090
ENTRYPOINT ["/app/main"]