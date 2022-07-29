function! gin#internal#core#attachement#attach_to(winid, ...) abort
  return denops#request('gin', 'attachement:attach_to', [a:winid] + a:000)
endfunction

function! gin#internal#core#attachement#detach_from(winid, ...) abort
  return denops#request('gin', 'attachement:datach_from', [a:winid] + a:000)
endfunction

function! gin#internal#core#attachement#close_all(winid) abort
  return denops#notify('gin', 'attachement:close_all', [a:winid])
endfunction
