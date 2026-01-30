package com.github.yhk1038.claudecodegui.services

import com.intellij.diff.DiffContentFactory
import com.intellij.diff.DiffManager
import com.intellij.diff.DiffRequestFactory
import com.intellij.diff.requests.SimpleDiffRequest
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFile
import java.io.File

/**
 * Service for handling diff viewing and file changes
 */
@Service(Service.Level.PROJECT)
class DiffService(private val project: Project) {
    private val logger = Logger.getInstance(DiffService::class.java)

    /**
     * Open IDE diff viewer for file changes
     *
     * @param filePath Absolute file path
     * @param oldContent Original content (empty string for new files)
     * @param newContent New content to apply
     */
    fun openDiffViewer(filePath: String, oldContent: String, newContent: String) {
        ApplicationManager.getApplication().invokeLater {
            try {
                val contentFactory = DiffContentFactory.getInstance()
                val requestFactory = DiffRequestFactory.getInstance()

                // Create diff contents - use explicit FileType parameter
                val leftContent = contentFactory.create(project, oldContent, null as com.intellij.openapi.fileTypes.FileType?)
                val rightContent = contentFactory.create(project, newContent, null as com.intellij.openapi.fileTypes.FileType?)

                // Create diff request with file name as title
                val fileName = File(filePath).name
                val request = SimpleDiffRequest(
                    "Diff: $fileName",
                    leftContent,
                    rightContent,
                    "Original",
                    "Proposed"
                )

                // Show in IDE diff viewer
                DiffManager.getInstance().showDiff(project, request)

                logger.info("Opened diff viewer for: $filePath")
            } catch (e: Exception) {
                logger.error("Failed to open diff viewer for: $filePath", e)
            }
        }
    }

    /**
     * Apply file changes
     *
     * @param filePath Absolute file path
     * @param newContent New content to write
     * @return Result indicating success or failure
     */
    fun applyDiff(filePath: String, newContent: String): Result<Unit> {
        return try {
            val file = File(filePath)

            // Ensure parent directory exists
            file.parentFile?.mkdirs()

            // Write content to file
            ApplicationManager.getApplication().runWriteAction {
                WriteCommandAction.runWriteCommandAction(project) {
                    // Refresh file system
                    val virtualFile = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(file)

                    if (virtualFile != null) {
                        // File exists - update content
                        val document = FileDocumentManager.getInstance().getDocument(virtualFile)
                        if (document != null) {
                            document.setText(newContent)
                        } else {
                            logger.warn("No document found for: $filePath, writing directly")
                            file.writeText(newContent)
                        }
                    } else {
                        // New file - create it
                        file.writeText(newContent)
                        LocalFileSystem.getInstance().refreshAndFindFileByIoFile(file)
                    }
                }
            }

            logger.info("Applied diff to: $filePath")
            Result.success(Unit)
        } catch (e: Exception) {
            logger.error("Failed to apply diff to: $filePath", e)
            Result.failure(e)
        }
    }

    /**
     * Apply edit operation (replace old_string with new_string)
     *
     * @param filePath Absolute file path
     * @param oldString String to find and replace
     * @param newString String to replace with
     * @return Result indicating success or failure
     */
    fun applyEdit(filePath: String, oldString: String, newString: String): Result<Unit> {
        return try {
            val file = File(filePath)

            if (!file.exists()) {
                return Result.failure(IllegalArgumentException("File does not exist: $filePath"))
            }

            // Read current content
            val currentContent = file.readText()

            // Check if old string exists
            if (!currentContent.contains(oldString)) {
                return Result.failure(IllegalArgumentException("Old string not found in file: $filePath"))
            }

            // Replace old string with new string
            val newContent = currentContent.replace(oldString, newString)

            // Write back
            ApplicationManager.getApplication().runWriteAction {
                WriteCommandAction.runWriteCommandAction(project) {
                    val virtualFile = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(file)

                    if (virtualFile != null) {
                        val document = FileDocumentManager.getInstance().getDocument(virtualFile)
                        if (document != null) {
                            document.setText(newContent)
                        } else {
                            file.writeText(newContent)
                        }
                    } else {
                        file.writeText(newContent)
                    }
                }
            }

            logger.info("Applied edit to: $filePath")
            Result.success(Unit)
        } catch (e: Exception) {
            logger.error("Failed to apply edit to: $filePath", e)
            Result.failure(e)
        }
    }

    /**
     * Delete file
     *
     * @param filePath Absolute file path
     * @return Result indicating success or failure
     */
    fun deleteFile(filePath: String): Result<Unit> {
        return try {
            val file = File(filePath)

            if (!file.exists()) {
                return Result.failure(IllegalArgumentException("File does not exist: $filePath"))
            }

            ApplicationManager.getApplication().runWriteAction {
                WriteCommandAction.runWriteCommandAction(project) {
                    val virtualFile = LocalFileSystem.getInstance().refreshAndFindFileByIoFile(file)
                    virtualFile?.delete(this)
                }
            }

            logger.info("Deleted file: $filePath")
            Result.success(Unit)
        } catch (e: Exception) {
            logger.error("Failed to delete file: $filePath", e)
            Result.failure(e)
        }
    }

    companion object {
        fun getInstance(project: Project): DiffService {
            return project.getService(DiffService::class.java)
        }
    }
}
