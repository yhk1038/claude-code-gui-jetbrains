import {FC} from "react";
import {RendererProps} from "../common";
import {ReadFileRenderer} from "./ReadFileRenderer";
import {ReadMediaFileRenderer} from "./ReadMediaFileRenderer";
import {ReadMultipleFilesRenderer} from "./ReadMultipleFilesRenderer";
import {WriteFileRenderer} from "./WriteFileRenderer";
import {EditFileRenderer} from "./EditFileRenderer";
import {ListDirectoryRenderer} from "./ListDirectoryRenderer";
import {DirectoryTreeRenderer} from "./DirectoryTreeRenderer";
import {MoveFileRenderer} from "./MoveFileRenderer";
import {CreateDirectoryRenderer} from "./CreateDirectoryRenderer";
import {SearchFilesRenderer} from "./SearchFilesRenderer";
import {GetFileInfoRenderer} from "./GetFileInfoRenderer";
import {ListAllowedDirectoriesRenderer} from "./ListAllowedDirectoriesRenderer";

export const FilesystemMcpRenderers: Array<[string, FC<RendererProps>]> = [
    ['read_file', ReadFileRenderer],
    ['read_text_file', ReadFileRenderer],
    ['mcp__filesystem__read_file', ReadFileRenderer],
    ['mcp__filesystem__read_text_file', ReadFileRenderer],
    ['read_media_file', ReadMediaFileRenderer],
    ['mcp__filesystem__read_media_file', ReadMediaFileRenderer],
    ['read_multiple_files', ReadMultipleFilesRenderer],
    ['mcp__filesystem__read_multiple_files', ReadMultipleFilesRenderer],
    ['write_file', WriteFileRenderer],
    ['mcp__filesystem__write_file', WriteFileRenderer],
    ['edit_file', EditFileRenderer],
    ['mcp__filesystem__edit_file', EditFileRenderer],
    ['list_directory', ListDirectoryRenderer],
    ['list_directory_with_sizes', ListDirectoryRenderer],
    ['mcp__filesystem__list_directory', ListDirectoryRenderer],
    ['mcp__filesystem__list_directory_with_sizes', ListDirectoryRenderer],
    ['directory_tree', DirectoryTreeRenderer],
    ['mcp__filesystem__directory_tree', DirectoryTreeRenderer],
    ['move_file', MoveFileRenderer],
    ['mcp__filesystem__move_file', MoveFileRenderer],
    ['create_directory', CreateDirectoryRenderer],
    ['mcp__filesystem__create_directory', CreateDirectoryRenderer],
    ['search_files', SearchFilesRenderer],
    ['mcp__filesystem__search_files', SearchFilesRenderer],
    ['get_file_info', GetFileInfoRenderer],
    ['mcp__filesystem__get_file_info', GetFileInfoRenderer],
    ['list_allowed_directories', ListAllowedDirectoriesRenderer],
    ['mcp__filesystem__list_allowed_directories', ListAllowedDirectoriesRenderer],
];
