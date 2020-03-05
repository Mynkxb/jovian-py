import os
from unittest import TestCase, mock
from unittest.mock import ANY, call
from contextlib import contextmanager
from jovian.utils.install import run_command, install, activate


@contextmanager
def fake_envfile(fname='environment-test.yml'):
    with open(fname, 'w') as f:
        data = """channels:
- defaults
dependencies:
- mixpanel=1.11.0
- sigmasix=1.91.0
- sqlite
- pip:
  - six==1.11.0
  - sqlite==2.0.0
name: test-env
prefix: /home/admin/anaconda3/envs/test-env
"""
        f.write(data)

    try:
        yield
    finally:
        # tearDown
        os.remove(fname)


@mock.patch("subprocess.Popen")
def test_run_command(mock_popen):
    with fake_envfile():
        mock_popen().communicate.return_value = (None, b'')
        run_command('conda env update --file environment-test.yml --name environment-name',
                    'environment-test.yml', ['mixpanel=1.11.0', 'sigmasix=1.91.0'])

        calls = [
            call(),
            call('conda env update --file environment-test.yml --name environment-name', shell=True, stderr=ANY),
            call().communicate()
        ]
        mock_popen.assert_has_calls(calls)


@mock.patch("subprocess.Popen")
def test_run_command_error(mock_popen):
    with fake_envfile():
        mock_popen().communicate.side_effect = [(None, b"""ResolvePackageNotFound: \n- mixpanel=1.11.0"""),
                                                (None, b'')]
        run_command('conda env update --file environment-test.yml --name environment-name',
                    'environment-test.yml', ['mixpanel=1.11.0', 'sigmasix=1.91.0'])

        calls = [
            call(),
            call('conda env update --file environment-test.yml --name environment-name', shell=True, stderr=ANY),
            call().communicate(),
            call('conda env update --file environment-test.yml --name environment-name', shell=True, stderr=-1),
            call().communicate()
        ]
        mock_popen.assert_has_calls(calls)


@mock.patch("subprocess.Popen")
def test_run_command_error_more_than_three(mock_popen):
    with fake_envfile():
        mock_popen().communicate.side_effect = [(None, b"""ResolvePackageNotFound: \n- mixpanel=1.11.0"""),
                                                (None, b"""ResolvePackageNotFound: \n- mixpanel=1.11.0"""),
                                                (None, b"""ResolvePackageNotFound: \n- mixpanel=1.11.0""")]

        run_command('conda env update --file environment-test.yml --name environment-name',
                    'environment-test.yml', ['mixpanel=1.11.0', 'sigmasix=1.91.0'])

        calls = [
            call(),
            call('conda env update --file environment-test.yml --name environment-name', shell=True, stderr=ANY),
            call().communicate(),
            call('conda env update --file environment-test.yml --name environment-name', shell=True, stderr=ANY),
            call().communicate(),
            call('conda env update --file environment-test.yml --name environment-name', shell=True, stderr=ANY),
            call().communicate()
        ]
        mock_popen.assert_has_calls(calls)


@mock.patch("subprocess.Popen")
def test_run_command_pip_failed(mock_popen):
    with fake_envfile():
        mock_popen().communicate.return_value = (None, b"""Pip failed""")

        assert run_command('conda env update --file environment-test.yml --name environment-name',
                           'environment-test.yml', ['mixpanel=1.11.0', 'sigmasix=1.91.0']) == False

        calls = [
            call(),
            call('conda env update --file environment-test.yml --name environment-name', shell=True, stderr=ANY),
            call().communicate()
        ]
        mock_popen.assert_has_calls(calls)


@mock.patch("jovian.utils.install.get_conda_bin", return_value="conda")
@mock.patch("jovian.utils.install.request_env_name", return_value="test-env")
@mock.patch("jovian.utils.install.run_command")
def test_install(mock_run_command, mock_request_env_name, mock_get_conda_bin):
    with fake_envfile():
        mock_run_command.return_value = True

        install('environment-test.yml')

        mock_run_command.assert_called_with(
            command='conda env update --file "environment-test.yml" --name "test-env"',
            env_fname='environment-test.yml',
            packages=['mixpanel=1.11.0', 'sigmasix=1.91.0', 'sqlite', 'six==1.11.0', 'sqlite==2.0.0'],
            run=1)


@mock.patch("jovian.utils.install.get_conda_bin", return_value="conda")
@mock.patch("jovian.utils.install.identify_env_file", return_value=None)
def test_install_env_fname_none(mock_identify_env_file, mock_get_conda_bin, capsys):
    install()

    expected_result = "[jovian] Error: Failed to detect a conda environment YML file. Skipping.."
    captured = capsys.readouterr()
    assert captured.err.strip() == expected_result


@mock.patch("jovian.utils.install.get_conda_bin", return_value="conda")
@mock.patch("jovian.utils.install.request_env_name", return_value=None)
def test_install_env_name_none(mock_request_env_name, mock_get_conda_bin, capsys):
    with fake_envfile():
        install('environment-test.yml')

        expected_result = """[jovian] Detected conda environment file: environment-test.yml

[jovian] Environment name not provided/detected. Skipping.."""
        captured = capsys.readouterr()
        assert captured.out.strip() == expected_result


@mock.patch("jovian.utils.install.get_conda_bin", return_value="conda")
@mock.patch("jovian.utils.install.request_env_name", return_value="test-env")
@mock.patch("jovian.utils.install.run_command")
def test_install_unsuccessful(mock_run_command, mock_request_env_name, mock_get_conda_bin, capsys):
    with fake_envfile():
        mock_run_command.return_value = False

        install('environment-test.yml')

        expected_result = """[jovian] Detected conda environment file: environment-test.yml

[jovian] Some pip packages failed to install.
[jovian] 
#
# To activate this environment, use
#
#     $ conda activate test-env
#
# To deactivate an active environment, use
#
#     $ conda deactivate"""

        captured = capsys.readouterr()
        assert captured.out.strip() == expected_result


@mock.patch("jovian.utils.install.get_conda_bin", return_value="conda")
def test_activate(mock_get_conda_bin, capsys):
    with fake_envfile():
        activate('environment-test.yml')

        expected_result = """
[jovian] Detected conda environment file: environment-test.yml

[jovian] Copy and execute the following command (try "source activate" if "conda activate doesn't work" )
    conda activate test-env"""

        captured = capsys.readouterr()
        assert expected_result.strip() in captured.out.strip()


def error_raiser(*args, **kwargs):
    raise Exception('fake error')


@mock.patch("jovian.utils.install.get_conda_bin", side_effect=error_raiser)
def test_activate_conda_not_found(mock_get_conda_bin, capsys):
    with fake_envfile():
        assert activate('environment-test.yml') == False

        expected_result = """[jovian] Error: Anaconda binary not found. Please make sure the "conda" command is in your system PATH or the environment variable $CONDA_EXE points to the anaconda binary"""

        captured = capsys.readouterr()
        assert expected_result.strip() in captured.err.strip()


@mock.patch("jovian.utils.install.identify_env_file", return_value=None)
@mock.patch("jovian.utils.install.get_conda_bin", return_value="conda")
def test_activate_env_fname_none(mock_get_conda_bin, mock_identify_env_file, capsys):
    with fake_envfile():
        assert activate('environment-test.yml') == False

        expected_result = """[jovian] Error: Failed to detect a conda environment YML file. Skipping.."""

        captured = capsys.readouterr()
        assert expected_result.strip() in captured.err.strip()


@mock.patch("jovian.utils.install.extract_env_name", return_value=None)
@mock.patch("jovian.utils.install.get_conda_bin", return_value="conda")
def test_activate_env_name_none(mock_get_conda_bin, mock_extract_env_name, capsys):
    with fake_envfile():
        activate('environment-test.yml')

        expected_result = """[jovian] Environment name not provided/detected. Skipping.."""

        captured = capsys.readouterr()
        assert expected_result.strip() in captured.out.strip()