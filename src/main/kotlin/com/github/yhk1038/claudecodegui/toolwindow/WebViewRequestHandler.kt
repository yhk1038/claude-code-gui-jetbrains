package com.github.yhk1038.claudecodegui.toolwindow

import com.intellij.openapi.diagnostic.Logger
import io.netty.channel.ChannelHandlerContext
import io.netty.handler.codec.http.FullHttpRequest
import io.netty.handler.codec.http.HttpRequest
import io.netty.handler.codec.http.HttpResponseStatus
import io.netty.handler.codec.http.QueryStringDecoder
import org.jetbrains.ide.HttpRequestHandler
import org.jetbrains.io.send
import java.io.ByteArrayOutputStream

class WebViewRequestHandler : HttpRequestHandler() {
    private val logger = Logger.getInstance(WebViewRequestHandler::class.java)

    companion object {
        const val PREFIX = "/claude-code-webview"

        private val CONTENT_TYPES = mapOf(
            "html" to "text/html; charset=UTF-8",
            "js" to "application/javascript; charset=UTF-8",
            "css" to "text/css; charset=UTF-8",
            "svg" to "image/svg+xml",
            "ttf" to "font/ttf",
            "woff" to "font/woff",
            "woff2" to "font/woff2",
            "png" to "image/png",
            "jpg" to "image/jpeg",
            "json" to "application/json; charset=UTF-8"
        )
    }

    override fun isAccessible(request: HttpRequest): Boolean {
        return request.uri().startsWith(PREFIX)
    }

    override fun process(
        urlDecoder: QueryStringDecoder,
        request: FullHttpRequest,
        context: ChannelHandlerContext
    ): Boolean {
        val path = urlDecoder.path()
        if (!path.startsWith(PREFIX)) return false

        // Extract resource path after prefix
        var resourcePath = path.removePrefix(PREFIX)
        if (resourcePath.isEmpty() || resourcePath == "/") {
            resourcePath = "/index.html"
        }

        val classpathResource = "/webview$resourcePath"
        logger.debug("Serving WebView resource: $classpathResource")

        val inputStream = javaClass.getResourceAsStream(classpathResource)
        if (inputStream == null) {
            logger.warn("WebView resource not found: $classpathResource")
            HttpResponseStatus.NOT_FOUND.send(context.channel(), request)
            return true
        }

        return try {
            val data = inputStream.use { stream ->
                val baos = ByteArrayOutputStream()
                stream.copyTo(baos)
                baos.toByteArray()
            }

            val extension = resourcePath.substringAfterLast('.', "")
            val contentType = CONTENT_TYPES[extension] ?: "application/octet-stream"

            val response = io.netty.handler.codec.http.DefaultFullHttpResponse(
                io.netty.handler.codec.http.HttpVersion.HTTP_1_1,
                HttpResponseStatus.OK,
                io.netty.buffer.Unpooled.wrappedBuffer(data)
            )
            response.headers().set("Content-Type", contentType)
            response.headers().set("Content-Length", data.size)
            response.headers().set("Cache-Control", "no-cache")
            context.channel().writeAndFlush(response)
            true
        } catch (e: Exception) {
            logger.error("Error serving WebView resource: $classpathResource", e)
            HttpResponseStatus.INTERNAL_SERVER_ERROR.send(context.channel(), request)
            true
        }
    }
}
