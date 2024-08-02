'use strict';
'require view';
'require form';
'require ui';
'require uci';
'require rpc';

var callInitAction = rpc.declare({
    object: 'luci',
    method: 'setInitAction',
    params: ['name', 'action'],
    expect: { result: false }
});

return view.extend({
    handleSaveApply: function(ev) {
        return this.handleSave(ev)
            .then(() => {
                return ui.changes.apply();
            })
            .then(() => {
                return uci.load('qosmate');
            })
            .then(() => {
                return uci.get_first('qosmate', 'global', 'enabled');
            })
            .then(enabled => {
                if (enabled === '0') {
                    return callInitAction('qosmate', 'stop');
                } else {
                    // Prüfen, ob es Änderungen gab
                    return uci.changes().then(changes => {
                        if (Object.keys(changes).length > 0) {
                            // Es gab Änderungen, also neu starten
                            return callInitAction('qosmate', 'restart');
                        }
                        // Keine Änderungen, nichts tun
                        return Promise.resolve();
                    });
                }
            })
            .then(() => {
                ui.hideModal();
                window.location.reload();
            })
            .catch((err) => {
                ui.hideModal();
                ui.addNotification(null, E('p', _('Failed to save settings or update QoSmate service: ') + err.message));
            });
    },

    render: function() {
        var m, s, o;

        m = new form.Map('qosmate', _('QoSmate HFSC Settings'), _('Configure HFSC settings for QoSmate.'));

        s = m.section(form.NamedSection, 'hfsc', 'hfsc', _('HFSC Settings'));
        s.anonymous = true;

        function createOption(name, title, description, placeholder, datatype) {
            var opt = s.option(form.Value, name, title, description);
            opt.datatype = datatype || 'string';
            opt.rmempty = true;
            opt.placeholder = placeholder;
            
            if (datatype === 'uinteger') {
                opt.validate = function(section_id, value) {
                    if (value === '' || value === null) return true;
                    if (!/^\d+$/.test(value)) return _('Must be a non-negative integer or empty');
                    return true;
                };
            }
            return opt;
        }

        o = s.option(form.ListValue, 'LINKTYPE', _('Link Type'), _('Select the link type'));
        o.value('ethernet', _('Ethernet'));
        o.value('atm', _('ATM'));
        o.value('adsl', _('ADSL'));
        o.default = 'ethernet';

        createOption('OH', _('Overhead'), _('Set the overhead'), _('Default: 44'), 'uinteger');

        o = s.option(form.ListValue, 'gameqdisc', _('Game Queue Discipline'), _('Select the queueing discipline for game traffic'));
        o.value('pfifo', _('PFIFO'));
        o.value('fq_codel', _('FQ_CODEL'));
        o.value('bfifo', _('BFIFO'));
        o.value('red', _('RED'));
        o.value('netem', _('NETEM'));
        o.default = 'pfifo';

        o = s.option(form.ListValue, 'nongameqdisc', _('Non-Game Queue Discipline'), _('Select the queueing discipline for non-game traffic'));
        o.value('fq_codel', _('FQ_CODEL'));
        o.value('cake', _('CAKE'));
        o.default = 'fq_codel';

        createOption('nongameqdiscoptions', _('Non-Game QDisc Options'), _('Cake options for non-game queueing discipline'), _('Default: besteffort ack-filter'));
        createOption('MAXDEL', _('Max Delay (ms)'), _('Maximum delay in milliseconds'), _('Default: 16'), 'uinteger');
        createOption('PFIFOMIN', _('PFIFO Min'), _('Minimum PFIFO value'), _('Default: 5'), 'uinteger');
        createOption('PACKETSIZE', _('Packet Size'), _('Average packet size'), _('Default: 450'), 'uinteger');
        createOption('netemdelayms', _('NETEM Delay (ms)'), _('NETEM delay in milliseconds'), _('Default: 30'), 'uinteger');
        createOption('netemjitterms', _('NETEM Jitter (ms)'), _('NETEM jitter in milliseconds'), _('Default: 7'), 'uinteger');
        
        o = s.option(form.ListValue, 'netemdist', _('NETEM Distribution'), _('NETEM delay distribution'));
        o.value('experimental', _('Experimental'));
        o.value('normal', _('Normal'));
        o.value('pareto', _('Pareto'));
        o.value('paretonormal', _('Pareto Normal'));
        o.default = 'normal';

        createOption('pktlossp', _('Packet Loss Percentage'), _('Percentage of packet loss'), _('Default: none'));

        return m.render();
    }
});