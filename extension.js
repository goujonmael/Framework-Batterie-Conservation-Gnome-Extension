/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('My Shiny Indicator'));

            this._icon = new St.Icon({
                icon_name: 'battery-full-symbolic',
                style_class: 'system-status-icon',
            });
            this.add_child(this._icon);

            this.connect('button-press-event', () => {
                this._toggleChargeLimit();
            });

            // Run command at initialization
            this._runInitialCommand();
        }

        _toggleIcon() {
            if (this._icon.icon_name === 'battery-full-symbolic') {
                this._icon.icon_name = 'battery-good-symbolic';
            } else {
                this._icon.icon_name = 'battery-full-symbolic';
            }
            // Debugging output
            log(`Icon changed to: ${this._icon.icon_name}`);
        }

        _toggleChargeLimit() {
            if (this._icon.icon_name === 'battery-full-symbolic') {
                this._runCommand(60);
            } else {
                this._runCommand(100);
            }
        }

        _runCommand(chargeLimit) {
            try {
                let proc = Gio.Subprocess.new(
                    ['sudo', 'framework_tool', '--charge-limit', chargeLimit.toString(), '--driver', 'portio'],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                        log(`Command stdout: ${stdout}`);
                        log(`Command stderr: ${stderr}`);
                        if (ok && proc.get_successful()) {
                            Main.notify(_('Charging Limit Set'), _('The charging limit is now set to ') + chargeLimit + '%');
                            this._toggleIcon();
                        } else {
                            log(`Command error: ${stderr}`);
                        }
                    } catch (e) {
                        logError(e);
                    }
                });
            } catch (e) {
                logError(e);
            }
        }

        _runInitialCommand() {
            try {
                let proc = Gio.Subprocess.new(
                    ['sudo', 'framework_tool', '--charge-limit', '--driver', 'portio'],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                proc.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                        if (ok) {
                            let match = stdout.match(/Maximum (\d+)%/);
                            if (match) {
                                let maxCharge = parseInt(match[1], 10);
                                log(`Maximum charge limit: ${maxCharge}`);
                                if (maxCharge === 100) {
                                    this._icon.icon_name = 'battery-full-symbolic';
                                } else {
                                    this._icon.icon_name = 'battery-good-symbolic';
                                }
                            } else {
                                log('Could not find Maximum charge limit in output');
                            }
                        } else {
                            log(`Initial command error: ${stderr}`);
                        }
                    } catch (e) {
                        logError(e);
                    }
                });
            } catch (e) {
                logError(e);
            }
        }
    });

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}