import { useMutation } from '@tanstack/react-query';
import React from 'react'
import { useForm } from 'react-hook-form'
import { PromData } from '../services/prom.service';

export const Generate = () => {

    const {register,handleSubmit,formState: { errors }} = useForm();


      const { mutate, data, isPending, error } = useMutation({
        mutationFn:PromData,
        onError:(error)=>{
           console.log(error)
        },
        onSuccess:(data)=>{
          console.log(data)
        }
    })
    const onSubmit =(data:any) =>{
        console.log(data)
        mutate(data)
    }

    return (

    <>
 <div className="flex min-h-screen flex-col bg-[#212121] text-white">
      <header className="border-b border-white/10 p-4">
        <h1 className="text-lg font-semibold">Agente Periferia</h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <h2 className="mb-8 text-center text-3xl font-semibold">
          ¿En qué puedo ayudarte?
        </h2>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full max-w-2xl items-center gap-3 rounded-3xl bg-[#303030] p-3"
        >
          <input
            type="text"
            placeholder="Escribe tu mensaje..."
            className="flex-1 bg-transparent p-2 outline-none placeholder:text-gray-400"
            {
                ...register("message",{
                    required:"Escribe un mensaje antes de enviar"
                })
            }
          />

          <button
            type="submit"
            className="rounded-full bg-white p-3 text-black hover:bg-gray-200 disabled:opacity-50"
          >
          </button>
        </form>

        {isPending && <p className="mt-4 text-sm text-gray-400">Generando respuesta...</p>}
        {error && <p className="mt-4 text-sm text-red-400">Error: {error.message}</p>}
        {data && <p className="mt-4 max-w-2xl whitespace-pre-wrap text-left">{data}</p>}

        <p className="mt-4 text-sm text-gray-400">
          ¿Qué quieres aprender hoy?
        </p>
      </main>
    </div>
    </>
  )
}
