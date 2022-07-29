if exists('g:loaded_gin_chaperon')
  finish
endif
let g:loaded_gin_chaperon = 1

function! s:command(...) abort
  if denops#plugin#wait('gin')
    return
  endif
  call denops#request('gin', 'chaperon:command', a:000)
endfunction

command! -bar -nargs=* GinChaperon call s:command(<q-mods>, <f-args>)
