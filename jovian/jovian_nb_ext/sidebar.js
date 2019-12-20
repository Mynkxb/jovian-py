/* jshint esnext: true, expr: true, sub: true, laxbreak: true */
/* eslint-env es6 */
/* global define */

define([
  "require",
  "jquery",
  "base/js/utils",
  "notebook/js/notebook",
  "nbextensions/jupyter_sidebar/resize-handle"
], (require, $, utils, nbmod) => {
  $("head").append(
    $("<link/>", {
      type: "text/css",
      rel: "stylesheet",
      href: require.toUrl("./sidebar.css")
    })
  );

  const _ = el => $(el).data("jupyter-ui");

  // Extended on Jquery UI 1.10 though might work further
  // not safe to use during _contactContainers (i.e. "change", "over", and "out" events)
  $.ui.sortable.prototype._refreshContainersAndCache = function() {
    this.containers = [this];
    var ctns = this._connectWith();
    if (!(ctns.length > 0 && this.ready)) return;
    if (ctns.constructor === Array) ctns = ctns.reduce((s, w) => s.add(w), $());

    ctns.each((i, c) => {
      const inst = $.data(c, this.widgetFullName);
      if (inst && inst !== this && !inst.options.disabled)
        this.containers.push(inst);
    });

    this.refreshPositions();
  };

  /**
   * A default config entry in config.data.Sidebar
   * @class SidebarConfigEntry
   * @param {Config}          config - notebook's config
   * @param {string}          id - id to search the config entry, empty
   *                          string to bypass config lookup
   * @param {Array}           defaults - with increasing precedence
   */
  function SidebarConfigEntry(config, id, ...defaults) {
    this.config = config;
    this.id = id;
    this.default = $.extend(true, {}, ...defaults);
  }

  SidebarConfigEntry.prototype.get = function(key) {
    return $.extend(
      true,
      {},
      this.default,
      this.config.data.Sidebar && this.config.data.Sidebar[this.id]
    )[key];
  };

  SidebarConfigEntry.prototype.set = function(...args) {
    if (args.length === 1) {
      for (var k in args[0]) {
        if (args[0].hasOwnProperty(k))
          SidebarConfigEntry.prototype.set.call(this, k, args[0][k]);
      }
    } else {
      if (this.id)
        this.config.update({ Sidebar: { [this.id]: { [args[0]]: args[1] } } });
      else this.default[args[0]] = args[1];
    }
  };

  const main_app = $("#ipython-main-app");

  const $app = main_app.find.bind(main_app);

  const add_sidebar_resizers = () =>
    $app("> :not(:last-child)").each((i, el) =>
      $(el).after(
        $("<div/>", { class: "resizer panel_resizer" }).resizeHandle({
          active: ".sidebar_panel:not(.empty)",
          sink: "#notebook_panel",
          stop: (e, handle, elems) =>
            elems.forEach(el => _(el).config.set("width", $(el).width()))
        })
      )
    );

  const clean_up_sidebars = ({ addEmptySidebar, notebook }) => {
    $app("> .panel_resizer").remove();

    $app("> .sidebar_panel:not(:has(> .sidebar_widget))").each((i, s) => {
      _(s).destruct();
      $(s).remove();
    });

    if (addEmptySidebar) {
      const sidebar_ids = $app("> .sidebar_panel")
        .map((i, s) => s.dataset.id)
        .toArray();
      const new_sidebar_ids = [];
      var i = 0;
      while (new_sidebar_ids.length < 2) {
        const sidebar_id = `sidebar-${i}`;
        if (sidebar_ids.indexOf(sidebar_id) === -1)
          new_sidebar_ids.push(sidebar_id);
        i++;
      }

      const nbp = $app("#notebook_panel"),
        empty_selector =
          ".sidebar_panel:not(:has(> .sidebar_widget:not(.ui-sortable-helper, .ui-sortable-placeholder)))";
      if (nbp.prev(empty_selector).length === 0)
        nbp.before(
          new Sidebar({ notebook: notebook, id: new_sidebar_ids[0] }).element
        );
      if (nbp.next(empty_selector).length === 0)
        nbp.after(
          new Sidebar({ notebook: notebook, id: new_sidebar_ids[1] }).element
        );
    }

    add_sidebar_resizers();
  };

  const set_sidebars_config = () => {
    const nbp = $app("#notebook_panel");
    nbp
      .prevAll(".sidebar_panel")
      .each((i, s) => _(s).config.set({ order: i - 128 }));
    nbp
      .nextAll(".sidebar_panel")
      .each((i, s) => _(s).config.set({ order: i + 1 }));
  };

  /**
   * Contains sidebar widgets
   * @class Sidebar
   * @param {object}          options - Dictionary of keyword arguments.
   * @param {object}          options.notebook
   * @param {string}          options.id
   * @param {string}          options.position - left|right
   * @param {float}           options.widgetAnimationDuration
   */
  function Sidebar({ notebook, id }) {
    this.id = id || utils.uuid();
    this.notebook = notebook;
    this.config = new SidebarConfigEntry(
      this.notebook.config,
      id,
      Sidebar.default_config
    );
    Sidebar.prototype.create_element.call(this);
  }

  Sidebar.default_config = { width: 300, order: 1 };

  // @final
  Sidebar.prototype.create_element = function() {
    this.element = $("<div/>", { class: "sidebar_panel" })
      .data("jupyter-ui", this)
      .sortable({
        connectWith: ".sidebar_panel",
        items: "> .sidebar_widget",
        handle: ".sidebar_header",
        tolerance: "pointer",
        start: e => {
          clean_up_sidebars({ addEmptySidebar: true, notebook: this.notebook });
          this.element.data("ui-sortable")._refreshContainersAndCache();
        },
        update: () => Sidebar.prototype.set_widgets_config.call(this),
        stop: () => {
          clean_up_sidebars({ addEmptySidebar: false });
          set_sidebars_config();
        }
      });
    new MutationObserver(mut => this.adjust_width()).observe(
      this.element.get(0),
      {
        childList: true
      }
    );
    this.element.get(0).dataset.id = this.id;
    this.handle = $("<div/>", { class: "sidebar_handle" });
    this.element.append(this.handle);

    this.adjust_width();

    // Menu item
    // const toggle_sidebar_handle = () => $app('> .sidebar_panel, > .resizer_panel').toggle(),
    //   toggle_sidebar = $(`
    // <li id="toggle_sidebar" title="Show/Hide sidebar">
    // <a href="#">Toggle Sidebar</a>
    // </li>`)
    //     .click(toggle_sidebar_handle)
    //     .appendTo($('#view_menu'));
    // env.actions.register(
    //   { handle: toggle_sidebar_handle },
    //   'toggle-sidebar',
    //   'notebook-sidebar'
    // );
  };

  // @final
  Sidebar.prototype.set_widgets_config = function() {
    this.element
      .find("> .sidebar_widget")
      .each((i, w) => _(w).config.set({ sidebar_id: this.id, order: i }));
  };

  Sidebar.prototype.adjust_width = function() {
    if (
      this.element.find("> .sidebar_widget:not(.ui-sortable-helper)").length > 0
    ) {
      this.element
        .removeClass("empty")
        .width(this.config.get("width"))
        .find("> .sidebar_widget")
        .show();
    } else {
      this.element
        .addClass("empty")
        .width(10)
        .find("> .sidebar_widget:not(.ui-sortable-helper)")
        .hide();
    }
    return this;
  };

  Sidebar.prototype.add_widget = function(widget) {
    this.element.append(widget.element);
    const get_order = el => _(el).config.get("order");
    this.element
      .find("> .sidebar_widget")
      .sort((a, b) => get_order(a) - get_order(b))
      .appendTo(this.element);

    this.adjust_width();
  };

  Sidebar.prototype.destruct = function() {
    this.element.find("> .sidebar_widget").each((i, w) => _(w).destruct());
  };

  /**
   * Base class for sidebar widget
   * @class Sidebar
   * @param {object}          options - Dictionary of keyword arguments.
   * @param {object}          options.notebook
   * @param {string}          options.header - used to generate widget id
   * @field {object}          this.config.get, this.config.set
   */
  function Widget({ notebook, header }) {
    this.id = header
      ? header.replace(/[ '"]/g, "-").toLowerCase()
      : utils.uuid();
    this.notebook = notebook;
    this.config = new SidebarConfigEntry(
      this.notebook.config,
      header ? this.id : null,
      Widget.default_config
    );
    Widget.prototype.create_element.call(this);
    Widget.prototype.update_header.call(this, header);
  }

  Widget.default_config = {
    order: Number.MAX_SAFE_INTEGER,
    collapsed: false,
    sidebar_id: "sidebar-0"
  };

  // @final
  Widget.prototype.create_element = function() {
    this.element = $("<div/>", { class: "sidebar_widget" }).data(
      "jupyter-ui",
      this
    );
    this.element.get(0).dataset.id = this.id;
    this.header = $("<div/>", {
      class: "sidebar_header sidebar_text"
    }).click(() =>
      this.config.get("collapsed") ? this.expand() : this.collapse()
    );
    this.body = $("<div/>", { class: "sidebar_body" });
    this.element.append([this.header, this.body]);
    if (this.config.get("collapsed")) this.collapse();
  };

  Widget.prototype.update_header = function(html) {
    this.header.html(html);
    return this;
  };

  Widget.prototype.expand = function() {
    this.element.removeClass("collapsed");
    this.config.set("collapsed", false);
  };

  Widget.prototype.collapse = function() {
    this.element.addClass("collapsed");
    this.config.set("collapsed", true);
  };

  Widget.prototype.destruct = function() {};

  /**
   * Table widget
   * @class Table
   * @param {object}          options - Dictionary of keyword arguments.
   * @param {object}          options.notebook
   * @param {string}          options.header
   * @param {int}             options.nColumn
   * @param {string}          options.info
   */
  function Table(options) {
    Widget.call(this, options);
    this.data = [];
    this.onRender = d => d;
    this.onSort = null;
    this.sortIndex = 0;
    this.ascendant = true;

    Table.prototype.create_element.call(this, options);
    Table.prototype.update_info.call(this, options.info);
  }

  Table.prototype = Object.create(Widget.prototype);
  Table.prototype.constructor = Table;

  // @final
  Table.prototype.create_element = function({ nColumn }) {
    const tbody = $("<div/>", { class: "sidebar_table_body" });
    this.info = $("<div/>", { class: "sidebar_table_info sidebar_text" });
    this.body.append([tbody, this.info]);
    this.columns = [];
    for (var i = 0; i < nColumn; i++) {
      const col = $("<div/>", { class: "sidebar_table_column" }).data(
        "index",
        i
      );
      tbody.append(col);
      this.columns.push(col);
      if (i !== nColumn - 1) {
        const resizer = $("<div/>", { class: "resizer" }).resizeHandle({
          active: ".sidebar_table_column",
          sink: ".sidebar_table_column:last-of-type"
        });
        tbody.append(resizer);
      }
    }
    const that = this;
    tbody.find("> .sidebar_table_column").click(function() {
      that.update({ sortIndex: $(this).data("index") });
    });
  };

  Table._get_compare_func = func => {
    return func.length < 2
      ? (x, y) => {
          const ix = func(x),
            iy = func(y);
          return ix < iy ? -1 : ix > iy ? 1 : 0;
        }
      : func;
  };

  /**
   * Update content of table
   * @class Table
   * @param {object}          options - Dictionary of keyword arguments.
   * @param {Array}           options.data
   * @param {function}        options.onRender
   * @param {Array}           options.onSort - contains compareFunctions or
   *                          indexFunctions
   * @param {int}             options.sortIndex
   */
  Table.prototype.update = function({ data, onRender, onSort, sortIndex }) {
    this.ascendant =
      !data && !onSort && sortIndex === this.sortIndex ? !this.ascendant : true;
    $.extend(this, {
      data: data,
      onRender: onRender,
      onSort: onSort,
      sortIndex: sortIndex
    });
    this.data.sort(
      this.onSort && Table._get_compare_func(this.onSort[this.sortIndex])
    );

    this.columns.forEach(c => c.empty());
    this.data.forEach(d =>
      this.onRender(d).forEach((c, i) => {
        if (i < this.columns.length) {
          const cell = $("<div/>", {
            html: c,
            class: "sidebar_table_cell sidebar_text"
          });
          if (this.ascendant) {
            this.columns[i].append(cell);
          } else {
            this.columns[i].prepend(cell);
          }
        }
      })
    );
    return this;
  };

  Table.prototype.update_info = function(info) {
    if (info) {
      this.info.html(info).show();
    } else {
      this.info.html("").hide();
    }
    return this;
  };

  /**
   * CommandOutput widget
   * @class CommandOutput
   * @param {object}          options - Dictionary of keyword arguments.
   * @param {string}          options.header
   * @param {object}          options.notebook
   * @param {string}          options.command
   */
  function CommandOutput(options) {
    Widget.call(this, options);
    this.command = options.command;

    CommandOutput.prototype.create_element.call(this);

    this.callback = () => {
      if (this.config.get("collapsed")) return;
      call_kernel({
        notebook: this.notebook,
        command: this.command
      }).then(text => this.output.text(text));
    };
    CommandOutput.prototype.bind_events.call(this);
  }

  CommandOutput.prototype = Object.create(Widget.prototype);
  CommandOutput.prototype.constructor = CommandOutput;

  // @final
  CommandOutput.prototype.create_element = function() {
    this.output = $("<div/>", { class: "sidebar_line sidebar_text" });
    this.output.css({ "white-space": "pre-wrap", "word-break": "break-all" });
    this.body.append(this.output);
  };

  // @final
  CommandOutput.prototype.bind_events = function() {
    this.notebook.events.on("kernel_ready.Kernel", this.callback);
    this.notebook.events.on("finished_execute.CodeCell", this.callback);
    if (this.notebook.kernel !== null) this.callback();
  };

  // @final
  CommandOutput.prototype.unbind_events = function() {
    this.notebook.events.off("kernel_ready.Kernel", this.callback);
    this.notebook.events.off("finished_execute.CodeCell", this.callback);
  };

  CommandOutput.prototype.expand = function() {
    Widget.prototype.expand.call(this);
    this.callback();
  };

  CommandOutput.prototype.destruct = function() {
    CommandOutput.prototype.unbind_events.call(this);
    Widget.prototype.destruct.call(this);
  };

  /**
   * Helper function to execute script
   * @param {object}          options.notebook
   * @param {string}          options.command
   */
  const call_kernel = ({ notebook, command }) =>
    new Promise((rsl, rjt) => {
      var stdout = "",
        stderr = "";
      const msg_id = notebook.kernel.execute(command, {
        iopub: {
          output: r => {
            if (r.parent_header.msg_id !== msg_id) return;
            if (r.msg_type === "stream") stdout += r.content.text;
            else rjt(r);
          }
        },
        shell: {
          reply: r => {
            if (r.parent_header.msg_id !== msg_id) return;
            if (r.content.status === "ok") rsl(stdout);
            else rjt(r);
          }
        }
      });
    });

  nbmod.Notebook.prototype.add_sidebar_widget = function(widget) {
    if (widget.notebook !== this) return false;
    const sidebar_id = widget.config.get("sidebar_id");
    var sidebar = $app(`> .sidebar_panel[data-id="${sidebar_id}"]`);
    if (sidebar.length > 0) {
      sidebar = _(sidebar);
      if (sidebar.notebook !== this) return false;
      sidebar.add_widget(widget);
    } else {
      sidebar = new Sidebar({ notebook: this, id: sidebar_id });
      sidebar.add_widget(widget);

      const get_order = el =>
        el.id === "notebook_panel" ? 0 : _(el).config.get("order");
      $app("> .panel_resizer").remove();
      main_app.append(sidebar.element);
      $app("> .sidebar_panel, > #notebook_panel")
        .sort((a, b) => get_order(a) - get_order(b))
        .appendTo(main_app);
      add_sidebar_resizers();
    }
    return true;
  };

  nbmod.Notebook.prototype.remove_sidebar_widget = function(widget) {
    if (widget.notebook !== this) return false;
    const sidebar = widget.element.closest(".sidebar_panel");
    widget.destruct();
    widget.element.remove();
    if (sidebar.find("> .sidebar_widget").length === 0) {
      _(sidebar).destruct();
      sidebar.remove();
    }
    return true;
  };

  return {
    Sidebar: Sidebar,
    Widget: Widget,
    Table: Table,
    CommandOutput: CommandOutput,
    call_kernel: call_kernel
  };
});
