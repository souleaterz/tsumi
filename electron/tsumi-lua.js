// mpv user-script source (Lua), embedded as a string so it can be written to a
// temp file at runtime. mpv is a separate process and can't read inside the
// packaged app.asar, so we never point --script at a file under electron/.
//
// It draws clickable "Skip Intro" / "Next Episode" buttons ON the video
// (bottom-right, above mpv's seek bar) based on AniSkip times passed via
// --script-opts. Clicking Skip Intro seeks past the opening; clicking Next
// Episode sends `script-message tsumi-next`, which surfaces on mpv's JSON IPC
// as a client-message the Electron main process forwards to the renderer.
//
// Binding MBTN_LEFT here is safe for the OSC seek bar: mpv's OSC handles its
// clicks in a *forced* input section that takes priority over this default-
// section binding, and over the rest of the video a left-click does nothing by
// default — so we only ever act when the click is inside our button.

module.exports = `
local assdraw = require 'mp.assdraw'
local opt = require 'mp.options'

local o = { op_start = -1, op_end = -1, ed_start = -1, has_next = false }
opt.read_options(o, "tsumi")

local overlay = mp.create_osd_overlay("ass-events")
local cur = nil  -- active button: {x1,y1,x2,y2,action}

local function hide()
  if cur ~= nil or overlay.data ~= "" then
    overlay.data = ""
    overlay:update()
    cur = nil
  end
end

local function render()
  local pos = mp.get_property_number("time-pos")
  if pos == nil then hide(); return end
  local dim = mp.get_property_native("osd-dimensions")
  if not dim or not dim.w or dim.w == 0 then hide(); return end
  local W, H = dim.w, dim.h

  local label, action
  if o.op_start >= 0 and o.op_end > o.op_start and pos >= o.op_start and pos < o.op_end - 0.3 then
    label = "Skip Intro"
    action = function() mp.set_property_number("time-pos", o.op_end) end
  elseif o.has_next and o.ed_start >= 0 and pos >= o.ed_start then
    label = "Next Episode"
    action = function() mp.commandv("script-message", "tsumi-next") end
  end

  if not label then hide(); return end

  local bw, bh = 196, 52
  local mx, my = 48, 104
  local x2, y2 = W - mx, H - my
  local x1, y1 = x2 - bw, y2 - bh

  local a = assdraw.ass_new()
  -- button background (dark, slightly translucent)
  a:new_event()
  a:append("{\\\\bord0\\\\shad0\\\\1c&H140F0A&\\\\1a&H1A&}")
  a:pos(0, 0); a:draw_start(); a:rect_cw(x1, y1, x2, y2); a:draw_stop()
  -- accent bar (Tsumi purple #A78BFA -> ASS BGR &HFA8BA7&)
  a:new_event()
  a:append("{\\\\bord0\\\\shad0\\\\1c&HFA8BA7&}")
  a:pos(0, 0); a:draw_start(); a:rect_cw(x1, y1, x1 + 4, y2); a:draw_stop()
  -- label
  a:new_event()
  a:an(5); a:pos((x1 + x2) / 2 + 2, (y1 + y2) / 2)
  a:append("{\\\\fs26\\\\b1\\\\bord0\\\\shad0\\\\1c&HFFFFFF&}" .. label .. "  \\194\\187")

  overlay.data = a.text
  overlay.res_x = W
  overlay.res_y = H
  overlay:update()
  cur = { x1 = x1, y1 = y1, x2 = x2, y2 = y2, action = action }
end

mp.observe_property("time-pos", "number", render)
mp.observe_property("osd-dimensions", "native", render)

mp.add_key_binding("MBTN_LEFT", "tsumi_click", function()
  if not cur then return end
  local m = mp.get_property_native("mouse-pos")
  if not m then return end
  if m.x >= cur.x1 and m.x <= cur.x2 and m.y >= cur.y1 and m.y <= cur.y2 then
    cur.action()
  end
end)
`;
