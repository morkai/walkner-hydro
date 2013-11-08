'use strict';

module.exports = function startAssetsRoutes(app, express)
{
  express.get('/assets/img/led.svg', serveLedSvg);

  express.get('/assets/img/led/:color.svg', serveLedSvg);

  express.get('/assets/img/switch.svg', serveSwitchSvg);

  function serveLedSvg(req, res)
  {
    var gradients = {
      black: ['#000', '8c8c8c'],
      blue: ['#09f', '#09f'],
      green: ['#0a0', '#0f0'],
      grey: ['#828282', '#929292'],
      orange: ['#a60', '#fa0'],
      red: ['#a00', '#f00'],
      white: ['#adadad', '#f0f0f0'],
      yellow: ['#aa0', '#ff0']
    };

    var color = req.query.color || req.params.color || 'grey';
    var stops = gradients[color] || gradients.grey;

    res.type('svg');
    res.render('svg/led', {
      stops: stops,
      gloss: stops !== gradients.grey
    });
  }

  function serveSwitchSvg(req, res)
  {
    /*jshint -W015*/

    var transition;

    switch (req.query.value)
    {
      case '2':
        transition = 'translate(89, 70) rotate(90, 10, 30)';
        break;

      case '1':
        transition = 'translate(89, 70) rotate(90, -20, 0) scale(1, -1)';
        break;

      default:
        transition = 'translate(89, 70)';
        break;
    }

    res.type('svg');
    res.render('svg/switch-knob', {
      direction: transition
    });
  }
};
