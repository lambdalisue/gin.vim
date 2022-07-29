if exists('g:loaded_gin_diff')
  finish
endif
let g:loaded_gin_diff = 1

augroup gin_plugin_diff_internal
  autocmd!
  autocmd BufReadCmd gindiff://* call denops#request('gin', 'diff:read', [])
augroup END

function! s:command(...) abort
  if denops#plugin#wait('gin')
    return
  endif
  call denops#request('gin', 'diff:command', a:000)
endfunction

command! -bar -nargs=* GinDiff call s:command(<q-mods>, <f-args>)
