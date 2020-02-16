/* jshint esnext: true, expr: true, sub: true */
/* eslint-env es6 */
/* global define */

define([
  "base/js/namespace",
  "nbextensions/jupyter_sidebar/sidebar",
  "nbextensions/jupyter_sidebar/numpy"
], (_, sidebarmod, sidebar_numpy) => {
  // Create and add the Numpy variables inspector
  const np_table = new sidebar_numpy.NumpyTable({
    notebook: _.notebook
  });

  _.notebook.add_sidebar_widget(np_table);

  // Create and add the welcoming message
  const msg = new sidebarmod.CommandOutput({
    notebook: _.notebook,
    header: "Welcoming Message",
    command: `
  def __jsb_msg():
    from jupyter_core.paths import jupyter_data_dir, jupyter_path
    import os
    for dir in [jupyter_data_dir()] + jupyter_path():
        path = os.path.join(dir, 'nbextensions/jupyter_sidebar/default.js')
        if (os.path.isfile(path)):
            print("""You can turn off this message in default.js located at:
  
      {0}
  
  or disable the default setting by running:
  
      jupyter nbextension disable jupyter_sidebar/default
  
  and write your own setting.""".format(path))
            break
  __jsb_msg()`
  });

  _.notebook.add_sidebar_widget(msg);

  // Uncomment this line to turn off the message
  // _.notebook.remove_sidebar_widget(msg);
});
