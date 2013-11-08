define([
  'underscore',
  'jquery',
  'app/viewport',
  'app/controller',
  'app/socket',
  'app/i18n',
  'app/core/View',
  'app/diagnostics/templates/vfd',
  'app/diagnostics/templates/vfdParam',
  'i18n!app/nls/diagnostics',
  'jquery.transit'
], function(
  _,
  $,
  viewport,
  controller,
  socket,
  t,
  View,
  vfdTemplate,
  vfdParamTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.VfdView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var VfdView = View.extend({

    template: vfdTemplate,

    remoteTopics: {
      'controller.vfdParamDiff': function(vfdParamDiff)
      {
        this.handleVfdParamDiff(vfdParamDiff);
      },
      'controller.comparingVfdParams': function(state)
      {
        this.$('.diag-vfd-read-form input').attr('disabled', !!state);
      }
    },

    events: {
      'submit .diag-vfd-read-form': function()
      {
        var $form = this.$('.diag-vfd-read-form');
        var $param = $form.find('input[name="param"]');
        var paramNo = $param.val().trim();

        if (!/^[0-9]+\-[0-9]+$/.test(paramNo))
        {
          $param.val('').focus();

          return false;
        }

        var master = $form.find('input[name="master"]').val();
        var unit = parseInt($form.find('input[name="unit"]').val(), 10) || 1;
        var id = master + ':' + unit + ':' + paramNo;

        var $tr = this.$('tr[data-id="' + id + '"]');

        if ($tr.length === 0)
        {
          $tr = this.createParamRow(id, master, unit, paramNo);
        }

        $tr.find('.action-read-param').click();

        $param.val('').focus();

        return false;
      },
      'click .action-compare-params': function()
      {
        socket.emit('controller.compareVfdParams');
      },
      'click .action-read-param': function(e)
      {
        this.readParam(this.$(e.target).closest('.action-read-param'));
      },
      'click .action-remove-param': function(e)
      {
        var $tr = this.$(e.target).closest('tr');

        $tr.fadeOut(function() { $tr.empty().remove(); });
      }
    }

  });

  VfdView.prototype.createParamRow = function(id, master, unit, no)
  {
    return $(vfdParamTemplate({
      id: id,
      master: master,
      unit: unit,
      no: no
    })).appendTo('tbody');
  };

  VfdView.prototype.readParam = function($action)
  {
    $action.focus();

    if ($action.attr('disabled') === 'disabled')
    {
      return;
    }

    $action.attr('disabled', true);

    var $td = $action.closest('tr').children();
    var req = {
      master: $td.eq(0).text(),
      unit: parseInt($td.eq(1).text(), 10),
      no: $td.eq(2).text()
    };
    var view = this;

    socket.emit('controller.readVfdParam', req, function(err, param)
    {
      if ($td.parent().length === 0)
      {
        return;
      }

      $action.attr('disabled', false);

      if (err)
      {
        viewport.msg.show({
          time: 3000,
          type: 'error',
          text: err.message
        });
      }
      else
      {
        view.fillParamData($td, param);
      }
    });
  };

  VfdView.prototype.fillParamData = function($td, param)
  {
    if (_.isNumber(param.unit))
    {
      $td.eq(1).text(param.unit);
    }

    if (_.isString(param.no))
    {
      $td.eq(2).text(param.no);
    }

    $td.eq(3).text(param.value);
    $td.eq(4).text(param.name);
    $td.eq(5).text(param.sets);
    $td.eq(6).text(param.workWrite);
    $td.eq(7).text(param.cIdx);
    $td.eq(8).text(param.type);
  };

  VfdView.prototype.handleVfdParamDiff = function(vfdParamDiff)
  {
    var param1Id = 'vfd:1:' + vfdParamDiff.no;
    var param3Id = 'vfd:3:' + vfdParamDiff.no;

    var $param1Tr = this.$('tr[data-id="' + param1Id + '"]');
    var $param3Tr = this.$('tr[data-id="' + param3Id + '"]');

    if ($param1Tr.length === 0)
    {
      $param1Tr = this.createParamRow(param1Id, 'vfd', 1, vfdParamDiff.no);
    }

    if ($param3Tr.length === 0)
    {
      $param3Tr = this.createParamRow(param3Id, 'vfd', 3, vfdParamDiff.no);
    }

    vfdParamDiff.unit = 1;
    vfdParamDiff.value = vfdParamDiff.values[0];

    this.fillParamData($param1Tr.children(), vfdParamDiff);

    vfdParamDiff.unit = 3;
    vfdParamDiff.value = vfdParamDiff.values[1];

    this.fillParamData($param3Tr.children(), vfdParamDiff);
  };

  return VfdView;
});
