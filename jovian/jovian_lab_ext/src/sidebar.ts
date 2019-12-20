import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

import { Dialog, showDialog } from "@jupyterlab/apputils";

import { ISettingRegistry } from "@jupyterlab/coreutils";

import { IDocumentManager } from "@jupyterlab/docmanager";

import { IFileBrowserFactory } from "@jupyterlab/filebrowser";

import { resetParams } from "./module2";
import NBKernel from "./NBKernel";
let body: any;

// Namespace for sidebar

const NAMESPACE = "jovian-sidebar";

// TO-DO: add new tab to sidebar
// TO-DO: create function for version control
// TO-DO: add commit function
// TO-DO: add share function
